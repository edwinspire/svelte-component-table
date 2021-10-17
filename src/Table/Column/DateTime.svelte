<script>
  export let value;
  const { DateTime } = require("luxon");
</script>

<td on:click>
  {DateTime.fromISO(value).toFormat("yyyy-MM-dd HH:mm:ss")}
</td>
