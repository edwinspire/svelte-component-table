<script>
  export let value;
  export const row = {};
  export const props = {};
  let option = "default";

  if (props.option) {
    option = props.option;
  }
</script>

{#if value}
  {#if option == "icon"}
    <td class="has-text-centered" on:click>
      <div class="icon-text">
        <span class="icon has-text-success">
          <i class="fas fa-check" />
        </span>
      </div>
    </td>
  {:else if option == "color-icon"}
    <td on:click class="has-background-danger has-text-white has-text-centered">
      <i class="fa fa-check" aria-hidden="true" />
    </td>
  {:else}
    <td class="has-text-centered" on:click>
      <input type="checkbox" checked={value} onclick="return false;" />
    </td>
  {/if}
{:else if option == "icon"}
  <td class="has-text-centered" on:click>
    <div class="icon-text">
      <span class="icon has-text-danger">
        <i class="fas fa-times" />
      </span>
    </div>
  </td>
{:else if option == "color-icon"}
  <td on:click class="has-background-danger has-text-white has-text-centered">
    <i class="fa fa-times" aria-hidden="true" />
  </td>
{:else}
  <td class="has-text-centered" on:click>
    <input type="checkbox" checked={value} onclick="return false;" />
  </td>
{/if}
