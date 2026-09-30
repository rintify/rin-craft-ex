import { netToSVG } from "../core/svg";
import type { NetResult, NetSettings } from "../core/unfold";

/** Consume the same SVG as preview/export. Geometry stays vector and mm-exact.
 * Small text images preserve Japanese glyphs without a network font dependency.
 */
export async function createPDF(
  net: NetResult,
  settings: NetSettings,
  onProgress: (value: number) => void,
) {
  if (net.errors.length || !net.pages)
    throw Error("出力できる展開図がありません。");
  const { jsPDF } = await import("jspdf");
  await document.fonts.ready;
  const orientation = net.width > net.height ? "landscape" : "portrait";
  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: [net.width, net.height],
    compress: true,
  });
  const parser = new DOMParser();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const pixelsPerMM = 600 / 25.4;
  for (let page = 0; page < net.pages; page++) {
    if (page) pdf.addPage([net.width, net.height], orientation);
    const svg = parser.parseFromString(
      netToSVG(net, settings, page),
      "image/svg+xml",
    );
    for (const node of svg.querySelectorAll("line,text")) {
      const n = (key: string) => Number(node.getAttribute(key));
      if (node.tagName === "line") {
        pdf.setDrawColor(node.getAttribute("stroke")!);
        pdf.setLineWidth(n("stroke-width"));
        pdf.setLineCap("round");
        pdf.line(n("x1"), n("y1"), n("x2"), n("y2"));
      } else {
        const text = node.textContent ?? "",
          size = n("font-size") * pixelsPerMM;
        context.font = `${size}px Arial, sans-serif`;
        const metrics = context.measureText(text);
        const ascent = Math.ceil(metrics.actualBoundingBoxAscent || size),
          descent = Math.ceil(metrics.actualBoundingBoxDescent || size * 0.25);
        canvas.width = Math.max(1, Math.ceil(metrics.width) + 4);
        canvas.height = ascent + descent + 4;
        context.font = `${size}px Arial, sans-serif`;
        context.fillStyle = node.getAttribute("fill") ?? "#54606a";
        context.fillText(text, 2, ascent + 2);
        const anchor = node.getAttribute("text-anchor"),
          align = anchor === "middle" ? 0.5 : anchor === "end" ? 1 : 0;
        pdf.addImage(
          canvas.toDataURL("image/png"),
          "PNG",
          n("x") - (metrics.width * align + 2) / pixelsPerMM,
          n("y") - (ascent + 2) / pixelsPerMM,
          canvas.width / pixelsPerMM,
          canvas.height / pixelsPerMM,
        );
      }
    }
    onProgress((page + 1) / net.pages);
    // Yield between pages so the custom progress UI remains responsive.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  }
  return pdf.output("datauristring");
}
