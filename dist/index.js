(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(require('Table/Table.svelte')) :
  typeof define === 'function' && define.amd ? define(['Table/Table.svelte'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Table));
})(this, (function (Table) { 'use strict';

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var Table__default = /*#__PURE__*/_interopDefaultLegacy(Table);

  const types = require("Table/Column/DefaultTypes.js");
  //export { default as default } from "./Table/Table.svelte";
  module.exports = {
    Table: Table__default["default"],
    ColumnTypes: types,
  };

}));
