  import CellTypes from "@edwinspire/utils/TableSvelte/Cell.js";
  import TableCellBoolean01 from "./TableCellBoolean01.svelte";
  import TableCellBoolean02 from "./TableCellBoolean02.svelte";
  import TableCellTextLimit from "./TableCellTextLimit.svelte";
  import DateTimeIsNotToday from "./TableCellDateTimeIsNotToday.svelte";
  import DateTime from "./TableCellDateTime.svelte";
  import DateCell from "./TableCellDate.svelte";
  import TableCellJSON from "./TableCellJSON.svelte";

  let CT = new CellTypes();
  CT.add(DateTimeIsNotToday, 'DateTimeIsNotToday');
  CT.add(DateTime, 'DateTime');
  CT.add(DateCell, 'Date');
  CT.add(TableCellTextLimit, 'TextLimited' );
  CT.add(TableCellBoolean01, 'BooleanIcon01' );
  CT.add(TableCellBoolean02, 'BooleanIcon02' );
  CT.add(TableCellJSON, 'Json');

  const CellTypesComponents = CT.types();

  //console.log('Table > Cells Types', CellTypesComponents);

export default CellTypesComponents;