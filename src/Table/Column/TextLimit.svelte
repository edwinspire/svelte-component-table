<script>
  export let value;
  let show = false;
  function ClickShow() {
    show = !show;
  }
</script>

<td class="" on:click>
  {#if value && typeof value === "string" && value.length > 30}
    {#if show}
      <div>
        {value}
        <span class="btn_show" on:click={ClickShow}> ver menos</span>
      </div>
    {:else}
      <div>
        {value.substring(0, 30)}...
        <span class="btn_show" on:click={ClickShow}> ver más</span>
      </div>
    {/if}
  {:else if typeof value === "string"}
    <div>
      {value}
    </div>
  {:else}
    <div>{JSON.stringify(value)}</div>
  {/if}
</td>

<style>
  .btn_show {
    color: rgb(0, 34, 145);
    cursor: pointer;
  }
</style>
