const { View, ScrollView, Image, Text } = require('react-native');

const noop = (value) => value;
const noopObj = {};

module.exports = {
  __esModule: true,
  default: {
    View,
    ScrollView,
    Image,
    Text,
    createAnimatedComponent: (Component) => Component,
  },
  View,
  ScrollView,
  Image,
  Text,
  createAnimatedComponent: (Component) => Component,
  useSharedValue: (initial) => ({ value: initial }),
  useAnimatedStyle: () => ({}),
  useAnimatedProps: () => ({}),
  useDerivedValue: (fn) => ({ value: typeof fn === 'function' ? fn() : fn }),
  withTiming: noop,
  withSpring: noop,
  withRepeat: noop,
  withSequence: (...values) => values[0],
  withDelay: (_, value) => value,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  Easing: {
    linear: noopObj,
    ease: noopObj,
    quad: noopObj,
    cubic: noopObj,
    sin: noopObj,
    out: () => noopObj,
    in: () => noopObj,
    inOut: () => noopObj,
  },
  FadeIn: undefined,
  FadeInDown: undefined,
  FadeOut: undefined,
  Layout: undefined,
  Keyframe: class Keyframe {
    duration() {
      return this;
    }
  },
};
