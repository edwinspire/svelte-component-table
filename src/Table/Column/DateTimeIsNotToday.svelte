<script>
  export let value;
  let DC001 = false;
  const { DateTime } = require("luxon");

  function fn_DC01() {
    DC001 = !(
      new Date(value).getFullYear() === new Date().getFullYear() &&
      new Date(value).getDate() === new Date().getDate()
    );
  }

  $: value, fn_DC01();
</script>

<td on:click class:has-text-danger={DC001}>
  {DateTime.fromISO(value).toFormat("yyyy-MM-dd HH:mm:ss")}
</td>
