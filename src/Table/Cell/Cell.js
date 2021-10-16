//import { ArrayChunk } from "@edwinspire/utils/ArrayChunk";
//sequential execution of promises in parallel blocks
export default class Cell {

  constructor(CellTypes) {
    this.cells = CellTypes || new Object();
  }

  add(svelte_component, name_cell, table_name, namespace) {
    this.cells = { ...this.cells, ...Cell.set(name_cell, table_name, namespace, svelte_component) }
  }
  types() {
    return this.cells;
  }

  join(cell_types) {
    this.cells = { ...this.cells, ...cell_types }
  }

  static set(name_cell, table_name, namespace, svelte_component) {
    let n = Cell.name(name_cell, table_name, namespace, svelte_component);
    let cell = new Object();
    cell[n] = svelte_component;
    return cell;
  }

  static name(name_cell, table_name, namespace) {
    let iname_cell = '';
    if (name_cell && name_cell.length > 0) {
      iname_cell = name_cell.toLowerCase();
    } else {
      throw 'name_cell no puede ser vacío o nulo';
    }


    let itable_name = 'table';
    if (table_name) {
      itable_name = table_name.toLowerCase();
    }

    let inamespace = 'main';
    if (namespace) {
      inamespace = namespace.toLowerCase();
    }


    return `/${inamespace}/${itable_name}/${iname_cell}`;
  }

}
