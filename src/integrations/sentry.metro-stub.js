module.exports = {
  init: () => {},
  wrap: (Component) => Component,
  captureException: () => undefined,
  captureMessage: () => undefined,
  setUser: () => {},
  withScope: (callback) =>
    callback({
      setUser: () => {},
      setTag: () => {},
    }),
};
