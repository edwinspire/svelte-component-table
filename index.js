import Table from "./src/Table/Table.svelte";
const types = require("./src/Table/Column/DefaultTypes.js");
//export { default as default } from "./Table/Table.svelte";
module.exports = {
  Table: Table,
  ColumnTypes: types,
};
