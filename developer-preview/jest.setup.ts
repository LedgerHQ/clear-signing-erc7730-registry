import "@testing-library/jest-dom";
import "fast-text-encoding";

global.fetch ??= () => Promise.reject(new Error("unimplemented"));
