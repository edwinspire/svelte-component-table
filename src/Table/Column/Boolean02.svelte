<script>
  export let value;
  //export let row = {};
</script>

{#if !value}
  <td on:click class="has-background-danger has-text-white has-text-centered">
    <i class="fa fa-times" aria-hidden="true" />
  </td>
{:else}
  <td on:click class="has-background-success has-text-white has-text-centered">
    <i class="fa fa-check" aria-hidden="true" />
  </td>
{/if}
