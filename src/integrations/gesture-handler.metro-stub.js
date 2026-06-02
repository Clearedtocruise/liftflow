const React = require('react');
const { View, ScrollView, FlatList, Switch, TextInput, DrawerLayoutAndroid } = require('react-native');

module.exports = {
  GestureHandlerRootView: View,
  ScrollView,
  FlatList,
  Switch,
  TextInput,
  DrawerLayoutAndroid,
  Swipeable: View,
  DrawerLayout: View,
  State: {},
  Directions: {},
  gestureHandlerRootHOC: (Component) => Component,
  PanGestureHandler: View,
  TapGestureHandler: View,
};
