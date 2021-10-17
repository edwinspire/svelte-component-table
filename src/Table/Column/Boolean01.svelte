<script>
  export let value;
  //export let row = {};
</script>

{#if value}
  <td class="has-text-centered" on:click>
    <div class="icon-text">
      <span class="icon has-text-success">
        <i class="fas fa-check" />
      </span>
    </div>
  </td>
{:else}
  <td class="has-text-centered" on:click
    ><div class="icon-text">
      <span class="icon has-text-danger">
        <i class="fas fa-times" />
      </span>
    </div></td
  >
{/if}
