import { generateNet } from "../core/unfold";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      id: data.id,
      result: generateNet(data.project, data.settings),
    });
  } catch (error) {
    self.postMessage({
      id: data.id,
      error:
        error instanceof Error
          ? error.message
          : "展開図を作成できませんでした。",
    });
  }
};
