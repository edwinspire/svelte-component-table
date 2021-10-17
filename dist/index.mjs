function noop() { }
function assign(tar, src) {
    // @ts-ignore
    for (const k in src)
        tar[k] = src[k];
    return tar;
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function create_slot(definition, ctx, $$scope, fn) {
    if (definition) {
        const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
        return definition[0](slot_ctx);
    }
}
function get_slot_context(definition, ctx, $$scope, fn) {
    return definition[1] && fn
        ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
        : $$scope.ctx;
}
function get_slot_changes(definition, $$scope, dirty, fn) {
    if (definition[2] && fn) {
        const lets = definition[2](fn(dirty));
        if ($$scope.dirty === undefined) {
            return lets;
        }
        if (typeof lets === 'object') {
            const merged = [];
            const len = Math.max($$scope.dirty.length, lets.length);
            for (let i = 0; i < len; i += 1) {
                merged[i] = $$scope.dirty[i] | lets[i];
            }
            return merged;
        }
        return $$scope.dirty | lets;
    }
    return $$scope.dirty;
}
function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
    if (slot_changes) {
        const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
        slot.p(slot_context, slot_changes);
    }
}
function get_all_dirty_from_scope($$scope) {
    if ($$scope.ctx.length > 32) {
        const dirty = [];
        const length = $$scope.ctx.length / 32;
        for (let i = 0; i < length; i++) {
            dirty[i] = -1;
        }
        return dirty;
    }
    return -1;
}
function compute_slots(slots) {
    const result = {};
    for (const key in slots) {
        result[key] = true;
    }
    return result;
}
function append(target, node) {
    target.appendChild(node);
}
function append_styles(target, style_sheet_id, styles) {
    const append_styles_to = get_root_for_style(target);
    if (!append_styles_to.getElementById(style_sheet_id)) {
        const style = element('style');
        style.id = style_sheet_id;
        style.textContent = styles;
        append_stylesheet(append_styles_to, style);
    }
}
function get_root_for_style(node) {
    if (!node)
        return document;
    const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
    if (root && root.host) {
        return root;
    }
    return node.ownerDocument;
}
function append_stylesheet(node, style) {
    append(node.head || node, style);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function set_data(text, data) {
    data = '' + data;
    if (text.wholeText !== data)
        text.data = data;
}
function set_input_value(input, value) {
    input.value = value == null ? '' : value;
}
function select_option(select, value) {
    for (let i = 0; i < select.options.length; i += 1) {
        const option = select.options[i];
        if (option.__value === value) {
            option.selected = true;
            return;
        }
    }
    select.selectedIndex = -1; // no option should be selected
}
function select_value(select) {
    const selected_option = select.querySelector(':checked') || select.options[0];
    return selected_option && selected_option.__value;
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}
function custom_event(type, detail, bubbles = false) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, bubbles, false, detail);
    return e;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
function onDestroy(fn) {
    get_current_component().$$.on_destroy.push(fn);
}
function createEventDispatcher() {
    const component = get_current_component();
    return (type, detail) => {
        const callbacks = component.$$.callbacks[type];
        if (callbacks) {
            // TODO are there situations where events could be dispatched
            // in a server (non-DOM) environment?
            const event = custom_event(type, detail);
            callbacks.slice().forEach(fn => {
                fn.call(component, event);
            });
        }
    };
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}
function outro_and_destroy_block(block, lookup) {
    transition_out(block, 1, 1, () => {
        lookup.delete(block.key);
    });
}
function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
    let o = old_blocks.length;
    let n = list.length;
    let i = o;
    const old_indexes = {};
    while (i--)
        old_indexes[old_blocks[i].key] = i;
    const new_blocks = [];
    const new_lookup = new Map();
    const deltas = new Map();
    i = n;
    while (i--) {
        const child_ctx = get_context(ctx, list, i);
        const key = get_key(child_ctx);
        let block = lookup.get(key);
        if (!block) {
            block = create_each_block(key, child_ctx);
            block.c();
        }
        else if (dynamic) {
            block.p(child_ctx, dirty);
        }
        new_lookup.set(key, new_blocks[i] = block);
        if (key in old_indexes)
            deltas.set(key, Math.abs(i - old_indexes[key]));
    }
    const will_move = new Set();
    const did_move = new Set();
    function insert(block) {
        transition_in(block, 1);
        block.m(node, next);
        lookup.set(block.key, block);
        next = block.first;
        n--;
    }
    while (o && n) {
        const new_block = new_blocks[n - 1];
        const old_block = old_blocks[o - 1];
        const new_key = new_block.key;
        const old_key = old_block.key;
        if (new_block === old_block) {
            // do nothing
            next = new_block.first;
            o--;
            n--;
        }
        else if (!new_lookup.has(old_key)) {
            // remove old block
            destroy(old_block, lookup);
            o--;
        }
        else if (!lookup.has(new_key) || will_move.has(new_key)) {
            insert(new_block);
        }
        else if (did_move.has(old_key)) {
            o--;
        }
        else if (deltas.get(new_key) > deltas.get(old_key)) {
            did_move.add(new_key);
            insert(new_block);
        }
        else {
            will_move.add(old_key);
            o--;
        }
    }
    while (o--) {
        const old_block = old_blocks[o];
        if (!new_lookup.has(old_block.key))
            destroy(old_block, lookup);
    }
    while (n)
        insert(new_blocks[n - 1]);
    return new_blocks;
}
function create_component(block) {
    block && block.c();
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

/* src\Table\Table.svelte generated by Svelte v3.43.2 */

function add_css(target) {
	append_styles(target, "svelte-mc39ac", ".size_search.svelte-mc39ac{width:7em}.show_cursor_mouse.svelte-mc39ac{cursor:pointer}.table_pagination.svelte-mc39ac{width:98%;margin:auto}.label_rows_per_page.svelte-mc39ac{margin-right:1em}.margin_title.svelte-mc39ac{margin-left:0.5em}.check_margin.svelte-mc39ac{margin-left:10px}");
}

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[72] = list[i];
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[75] = list[i];
	child_ctx[77] = i;
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[78] = list[i];
	child_ctx[80] = i;
	return child_ctx;
}

function get_each_context_3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[78] = list[i];
	child_ctx[82] = i;
	return child_ctx;
}

const get_item5_slot_changes = dirty => ({});
const get_item5_slot_context = ctx => ({});
const get_item4_slot_changes = dirty => ({});
const get_item4_slot_context = ctx => ({});
const get_item3_slot_changes = dirty => ({});
const get_item3_slot_context = ctx => ({});
const get_item2_slot_changes = dirty => ({});
const get_item2_slot_context = ctx => ({});
const get_item1_slot_changes = dirty => ({});
const get_item1_slot_context = ctx => ({});
const get_title_slot_changes = dirty => ({});
const get_title_slot_context = ctx => ({});

// (389:52) .
function fallback_block(ctx) {
	let t;

	return {
		c() {
			t = text(".");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (400:10) {:else}
function create_else_block_2(ctx) {
	let i;

	return {
		c() {
			i = element("i");
			attr(i, "class", "fas fa-hourglass-half");
		},
		m(target, anchor) {
			insert(target, i, anchor);
		},
		d(detaching) {
			if (detaching) detach(i);
		}
	};
}

// (398:10) {#if loading}
function create_if_block_24(ctx) {
	let i;

	return {
		c() {
			i = element("i");
			attr(i, "class", "fas fa-spinner fa-pulse");
		},
		m(target, anchor) {
			insert(target, i, anchor);
		},
		d(detaching) {
			if (detaching) detach(i);
		}
	};
}

// (409:4) {#if $$slots.item1}
function create_if_block_23(ctx) {
	let div;
	let current;
	const item1_slot_template = /*#slots*/ ctx[38].item1;
	const item1_slot = create_slot(item1_slot_template, ctx, /*$$scope*/ ctx[37], get_item1_slot_context);

	return {
		c() {
			div = element("div");
			if (item1_slot) item1_slot.c();
			attr(div, "class", "level-item");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (item1_slot) {
				item1_slot.m(div, null);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (item1_slot) {
				if (item1_slot.p && (!current || dirty[1] & /*$$scope*/ 64)) {
					update_slot_base(
						item1_slot,
						item1_slot_template,
						ctx,
						/*$$scope*/ ctx[37],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[37])
						: get_slot_changes(item1_slot_template, /*$$scope*/ ctx[37], dirty, get_item1_slot_changes),
						get_item1_slot_context
					);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(item1_slot, local);
			current = true;
		},
		o(local) {
			transition_out(item1_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if (item1_slot) item1_slot.d(detaching);
		}
	};
}

// (414:4) {#if $$slots.item2}
function create_if_block_22(ctx) {
	let div;
	let current;
	const item2_slot_template = /*#slots*/ ctx[38].item2;
	const item2_slot = create_slot(item2_slot_template, ctx, /*$$scope*/ ctx[37], get_item2_slot_context);

	return {
		c() {
			div = element("div");
			if (item2_slot) item2_slot.c();
			attr(div, "class", "level-item");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (item2_slot) {
				item2_slot.m(div, null);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (item2_slot) {
				if (item2_slot.p && (!current || dirty[1] & /*$$scope*/ 64)) {
					update_slot_base(
						item2_slot,
						item2_slot_template,
						ctx,
						/*$$scope*/ ctx[37],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[37])
						: get_slot_changes(item2_slot_template, /*$$scope*/ ctx[37], dirty, get_item2_slot_changes),
						get_item2_slot_context
					);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(item2_slot, local);
			current = true;
		},
		o(local) {
			transition_out(item2_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if (item2_slot) item2_slot.d(detaching);
		}
	};
}

// (419:4) {#if $$slots.item3}
function create_if_block_21(ctx) {
	let div;
	let current;
	const item3_slot_template = /*#slots*/ ctx[38].item3;
	const item3_slot = create_slot(item3_slot_template, ctx, /*$$scope*/ ctx[37], get_item3_slot_context);

	return {
		c() {
			div = element("div");
			if (item3_slot) item3_slot.c();
			attr(div, "class", "level-item");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (item3_slot) {
				item3_slot.m(div, null);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (item3_slot) {
				if (item3_slot.p && (!current || dirty[1] & /*$$scope*/ 64)) {
					update_slot_base(
						item3_slot,
						item3_slot_template,
						ctx,
						/*$$scope*/ ctx[37],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[37])
						: get_slot_changes(item3_slot_template, /*$$scope*/ ctx[37], dirty, get_item3_slot_changes),
						get_item3_slot_context
					);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(item3_slot, local);
			current = true;
		},
		o(local) {
			transition_out(item3_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if (item3_slot) item3_slot.d(detaching);
		}
	};
}

// (424:4) {#if $$slots.item4}
function create_if_block_20(ctx) {
	let div;
	let current;
	const item4_slot_template = /*#slots*/ ctx[38].item4;
	const item4_slot = create_slot(item4_slot_template, ctx, /*$$scope*/ ctx[37], get_item4_slot_context);

	return {
		c() {
			div = element("div");
			if (item4_slot) item4_slot.c();
			attr(div, "class", "level-item");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (item4_slot) {
				item4_slot.m(div, null);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (item4_slot) {
				if (item4_slot.p && (!current || dirty[1] & /*$$scope*/ 64)) {
					update_slot_base(
						item4_slot,
						item4_slot_template,
						ctx,
						/*$$scope*/ ctx[37],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[37])
						: get_slot_changes(item4_slot_template, /*$$scope*/ ctx[37], dirty, get_item4_slot_changes),
						get_item4_slot_context
					);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(item4_slot, local);
			current = true;
		},
		o(local) {
			transition_out(item4_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if (item4_slot) item4_slot.d(detaching);
		}
	};
}

// (429:4) {#if $$slots.item5}
function create_if_block_19(ctx) {
	let div;
	let current;
	const item5_slot_template = /*#slots*/ ctx[38].item5;
	const item5_slot = create_slot(item5_slot_template, ctx, /*$$scope*/ ctx[37], get_item5_slot_context);

	return {
		c() {
			div = element("div");
			if (item5_slot) item5_slot.c();
			attr(div, "class", "level-item");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (item5_slot) {
				item5_slot.m(div, null);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (item5_slot) {
				if (item5_slot.p && (!current || dirty[1] & /*$$scope*/ 64)) {
					update_slot_base(
						item5_slot,
						item5_slot_template,
						ctx,
						/*$$scope*/ ctx[37],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[37])
						: get_slot_changes(item5_slot_template, /*$$scope*/ ctx[37], dirty, get_item5_slot_changes),
						get_item5_slot_context
					);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(item5_slot, local);
			current = true;
		},
		o(local) {
			transition_out(item5_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			if (item5_slot) item5_slot.d(detaching);
		}
	};
}

// (435:4) {#if ShowNewButton}
function create_if_block_18(ctx) {
	let div;
	let button;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			button = element("button");
			button.innerHTML = `<span class="icon"><i class="far fa-file"></i></span>`;
			attr(button, "class", "button is-small");
			attr(div, "class", "level-item");
			attr(div, "title", "Agregar fila");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, button);

			if (!mounted) {
				dispose = listen(button, "click", /*HClickNew*/ ctx[22]);
				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(div);
			mounted = false;
			dispose();
		}
	};
}

// (445:4) {#if ShowEditButton}
function create_if_block_17(ctx) {
	let div;
	let button;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			button = element("button");
			button.innerHTML = `<span class="icon"><i class="far fa-edit"></i></span>`;
			attr(button, "class", "button is-small");
			attr(div, "class", "level-item");
			attr(div, "title", "Editar");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, button);

			if (!mounted) {
				dispose = listen(button, "click", /*HandleOnClickEdit*/ ctx[29]);
				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(div);
			mounted = false;
			dispose();
		}
	};
}

// (801:0) {:else}
function create_else_block_1(ctx) {
	let div;

	return {
		c() {
			div = element("div");

			div.innerHTML = `<i class="fa fa-table" aria-hidden="true"></i>
    No hay datos que mostrar`;

			attr(div, "class", "has-text-centered has-text-link-dark");
		},
		m(target, anchor) {
			insert(target, div, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (555:0) {#if DataTable && DataTable.length > 0}
function create_if_block(ctx) {
	let div0;
	let table;
	let thead;
	let tr;
	let th;
	let t1;
	let t2;
	let t3;
	let t4;
	let t5;
	let tbody;
	let each_blocks = [];
	let each1_lookup = new Map();
	let t6;
	let div4;
	let nav;
	let div1;
	let t7;
	let div3;
	let span1;
	let span0;
	let t9;
	let div2;
	let select;
	let option0;
	let option1;
	let option2;
	let option3;
	let option4;
	let current;
	let mounted;
	let dispose;
	let if_block0 = /*SelectionType*/ ctx[0] == 1 && create_if_block_16();
	let if_block1 = /*SelectionType*/ ctx[0] == 2 && create_if_block_15(ctx);
	let if_block2 = /*showEdit*/ ctx[8] && create_if_block_14();
	let each_value_3 = Object.keys(/*DataTable*/ ctx[5][0]);
	let each_blocks_1 = [];

	for (let i = 0; i < each_value_3.length; i += 1) {
		each_blocks_1[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
	}

	let each_value_1 = /*DataTable*/ ctx[5];
	const get_key = ctx => /*dataRow*/ ctx[75].internal_hash_row;

	for (let i = 0; i < each_value_1.length; i += 1) {
		let child_ctx = get_each_context_1(ctx, each_value_1, i);
		let key = get_key(child_ctx);
		each1_lookup.set(key, each_blocks[i] = create_each_block_1(key, child_ctx));
	}

	let if_block3 = /*paginatedData*/ ctx[14] && /*paginatedData*/ ctx[14].length > 1 && create_if_block_1(ctx);

	return {
		c() {
			div0 = element("div");
			table = element("table");
			thead = element("thead");
			tr = element("tr");
			th = element("th");
			th.textContent = "#";
			t1 = space();
			if (if_block0) if_block0.c();
			t2 = space();
			if (if_block1) if_block1.c();
			t3 = space();
			if (if_block2) if_block2.c();
			t4 = space();

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].c();
			}

			t5 = space();
			tbody = element("tbody");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t6 = space();
			div4 = element("div");
			nav = element("nav");
			div1 = element("div");
			if (if_block3) if_block3.c();
			t7 = space();
			div3 = element("div");
			span1 = element("span");
			span0 = element("span");
			span0.textContent = "Filas por página";
			t9 = space();
			div2 = element("div");
			select = element("select");
			option0 = element("option");
			option0.textContent = "20";
			option1 = element("option");
			option1.textContent = "50";
			option2 = element("option");
			option2.textContent = "100";
			option3 = element("option");
			option3.textContent = "200";
			option4 = element("option");
			option4.textContent = "300";
			attr(th, "class", "has-text-centered");
			attr(table, "class", "table is-bordered is-striped is-narrow is-hoverable is-fullwidth");
			attr(div0, "class", "table-container is-size-7");
			attr(div1, "class", "level-left");
			attr(span0, "class", "label_rows_per_page svelte-mc39ac");
			option0.__value = "20";
			option0.value = option0.__value;
			option0.selected = true;
			option1.__value = "50";
			option1.value = option1.__value;
			option2.__value = "100";
			option2.value = option2.__value;
			option3.__value = "200";
			option3.value = option3.__value;
			option4.__value = "300";
			option4.value = option4.__value;
			attr(select, "name", "rows_per_page");
			if (/*RowsPerPage*/ ctx[11] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[52].call(select));
			attr(div2, "class", "select is-small");
			attr(span1, "class", "level-item");
			attr(div3, "class", "level-right");
			attr(nav, "class", "level");
			attr(div4, "class", "table_pagination svelte-mc39ac");
		},
		m(target, anchor) {
			insert(target, div0, anchor);
			append(div0, table);
			append(table, thead);
			append(thead, tr);
			append(tr, th);
			append(tr, t1);
			if (if_block0) if_block0.m(tr, null);
			append(tr, t2);
			if (if_block1) if_block1.m(tr, null);
			append(tr, t3);
			if (if_block2) if_block2.m(tr, null);
			append(tr, t4);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].m(tr, null);
			}

			append(table, t5);
			append(table, tbody);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(tbody, null);
			}

			insert(target, t6, anchor);
			insert(target, div4, anchor);
			append(div4, nav);
			append(nav, div1);
			if (if_block3) if_block3.m(div1, null);
			append(nav, t7);
			append(nav, div3);
			append(div3, span1);
			append(span1, span0);
			append(span1, t9);
			append(span1, div2);
			append(div2, select);
			append(select, option0);
			append(select, option1);
			append(select, option2);
			append(select, option3);
			append(select, option4);
			select_option(select, /*RowsPerPage*/ ctx[11]);
			current = true;

			if (!mounted) {
				dispose = [
					listen(select, "change", /*select_change_handler*/ ctx[52]),
					listen(select, "change", /*change_handler_3*/ ctx[53])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (/*SelectionType*/ ctx[0] == 1) {
				if (if_block0) ; else {
					if_block0 = create_if_block_16();
					if_block0.c();
					if_block0.m(tr, t2);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (/*SelectionType*/ ctx[0] == 2) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_15(ctx);
					if_block1.c();
					if_block1.m(tr, t3);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (/*showEdit*/ ctx[8]) {
				if (if_block2) ; else {
					if_block2 = create_if_block_14();
					if_block2.c();
					if_block2.m(tr, t4);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if (dirty[0] & /*DataTable, HClickHeader, internal_columns*/ 8421408) {
				each_value_3 = Object.keys(/*DataTable*/ ctx[5][0]);
				let i;

				for (i = 0; i < each_value_3.length; i += 1) {
					const child_ctx = get_each_context_3(ctx, each_value_3, i);

					if (each_blocks_1[i]) {
						each_blocks_1[i].p(child_ctx, dirty);
					} else {
						each_blocks_1[i] = create_each_block_3(child_ctx);
						each_blocks_1[i].c();
						each_blocks_1[i].m(tr, null);
					}
				}

				for (; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].d(1);
				}

				each_blocks_1.length = each_value_3.length;
			}

			if (dirty[0] & /*DataTable, internal_columns, HClickCell, Json, HClickEditRow, showEdit, RowIsSelected, HandleOnRowSelected, SelectionType, RowsPerPage, PageSelected*/ 1077251361) {
				each_value_1 = /*DataTable*/ ctx[5];
				group_outros();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each1_lookup, tbody, outro_and_destroy_block, create_each_block_1, null, get_each_context_1);
				check_outros();
			}

			if (/*paginatedData*/ ctx[14] && /*paginatedData*/ ctx[14].length > 1) {
				if (if_block3) {
					if_block3.p(ctx, dirty);
				} else {
					if_block3 = create_if_block_1(ctx);
					if_block3.c();
					if_block3.m(div1, null);
				}
			} else if (if_block3) {
				if_block3.d(1);
				if_block3 = null;
			}

			if (dirty[0] & /*RowsPerPage*/ 2048) {
				select_option(select, /*RowsPerPage*/ ctx[11]);
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value_1.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(div0);
			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			destroy_each(each_blocks_1, detaching);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}

			if (detaching) detach(t6);
			if (detaching) detach(div4);
			if (if_block3) if_block3.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

// (564:10) {#if SelectionType == 1}
function create_if_block_16(ctx) {
	let th;

	return {
		c() {
			th = element("th");
			th.innerHTML = `<span>-</span>`;
			attr(th, "class", "has-text-centered");
		},
		m(target, anchor) {
			insert(target, th, anchor);
		},
		d(detaching) {
			if (detaching) detach(th);
		}
	};
}

// (568:10) {#if SelectionType == 2}
function create_if_block_15(ctx) {
	let th;
	let input;
	let mounted;
	let dispose;

	return {
		c() {
			th = element("th");
			input = element("input");
			attr(input, "type", "checkbox");
			attr(th, "class", "has-text-centered");
		},
		m(target, anchor) {
			insert(target, th, anchor);
			append(th, input);

			if (!mounted) {
				dispose = listen(input, "click", /*handleChangeSelectAll*/ ctx[25]);
				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(th);
			mounted = false;
			dispose();
		}
	};
}

// (574:10) {#if showEdit}
function create_if_block_14(ctx) {
	let th;

	return {
		c() {
			th = element("th");
			th.innerHTML = `<i class="fas fa-pen"></i>`;
			attr(th, "class", "has-text-centered");
		},
		m(target, anchor) {
			insert(target, th, anchor);
		},
		d(detaching) {
			if (detaching) detach(th);
		}
	};
}

// (582:12) {#if internal_columns[item]}
function create_if_block_12(ctx) {
	let if_block_anchor;
	let if_block = (!/*internal_columns*/ ctx[15][/*item*/ ctx[78]].hidden || !/*internal_columns*/ ctx[15][/*item*/ ctx[78]].hidden == null) && create_if_block_13(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (!/*internal_columns*/ ctx[15][/*item*/ ctx[78]].hidden || !/*internal_columns*/ ctx[15][/*item*/ ctx[78]].hidden == null) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_13(ctx);
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		d(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

// (583:14) {#if !internal_columns[item].hidden || !internal_columns[item].hidden == null}
function create_if_block_13(ctx) {
	let th;
	let t0_value = /*internal_columns*/ ctx[15][/*item*/ ctx[78]].label + "";
	let t0;
	let t1;
	let th_data_column_value;
	let mounted;
	let dispose;

	return {
		c() {
			th = element("th");
			t0 = text(t0_value);
			t1 = space();
			attr(th, "class", "has-text-centered show_cursor_mouse svelte-mc39ac");
			attr(th, "data-column", th_data_column_value = /*item*/ ctx[78]);
		},
		m(target, anchor) {
			insert(target, th, anchor);
			append(th, t0);
			append(th, t1);

			if (!mounted) {
				dispose = listen(th, "click", /*HClickHeader*/ ctx[23]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*internal_columns, DataTable*/ 32800 && t0_value !== (t0_value = /*internal_columns*/ ctx[15][/*item*/ ctx[78]].label + "")) set_data(t0, t0_value);

			if (dirty[0] & /*DataTable*/ 32 && th_data_column_value !== (th_data_column_value = /*item*/ ctx[78])) {
				attr(th, "data-column", th_data_column_value);
			}
		},
		d(detaching) {
			if (detaching) detach(th);
			mounted = false;
			dispose();
		}
	};
}

// (580:10) {#each Object.keys(DataTable[0]) as item, ith}
function create_each_block_3(ctx) {
	let if_block_anchor;
	let if_block = /*internal_columns*/ ctx[15][/*item*/ ctx[78]] && create_if_block_12(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (/*internal_columns*/ ctx[15][/*item*/ ctx[78]]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_12(ctx);
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		d(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

// (601:12) {#if SelectionType == 1}
function create_if_block_11(ctx) {
	let td;
	let input;
	let input_checked_value;
	let input_data_internal_hash_row_value;
	let mounted;
	let dispose;

	return {
		c() {
			td = element("td");
			input = element("input");
			attr(input, "type", "radio");
			attr(input, "name", "single_select");
			attr(input, "class", "show_cursor_mouse svelte-mc39ac");
			input.checked = input_checked_value = /*RowIsSelected*/ ctx[18](/*dataRow*/ ctx[75].internal_hash_row);
			attr(input, "data-internal_hash_row", input_data_internal_hash_row_value = /*dataRow*/ ctx[75].internal_hash_row);
			attr(td, "class", "has-text-centered");
		},
		m(target, anchor) {
			insert(target, td, anchor);
			append(td, input);

			if (!mounted) {
				dispose = listen(input, "click", /*HandleOnRowSelected*/ ctx[30]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*DataTable*/ 32 && input_checked_value !== (input_checked_value = /*RowIsSelected*/ ctx[18](/*dataRow*/ ctx[75].internal_hash_row))) {
				input.checked = input_checked_value;
			}

			if (dirty[0] & /*DataTable*/ 32 && input_data_internal_hash_row_value !== (input_data_internal_hash_row_value = /*dataRow*/ ctx[75].internal_hash_row)) {
				attr(input, "data-internal_hash_row", input_data_internal_hash_row_value);
			}
		},
		d(detaching) {
			if (detaching) detach(td);
			mounted = false;
			dispose();
		}
	};
}

// (614:12) {#if SelectionType == 2}
function create_if_block_10(ctx) {
	let td;
	let input;
	let input_checked_value;
	let input_data_internal_hash_row_value;
	let mounted;
	let dispose;

	return {
		c() {
			td = element("td");
			input = element("input");
			attr(input, "class", "show_cursor_mouse svelte-mc39ac");
			attr(input, "type", "checkbox");
			input.checked = input_checked_value = /*RowIsSelected*/ ctx[18](/*dataRow*/ ctx[75].internal_hash_row);
			attr(input, "data-internal_hash_row", input_data_internal_hash_row_value = /*dataRow*/ ctx[75].internal_hash_row);
			attr(td, "class", "has-text-centered");
		},
		m(target, anchor) {
			insert(target, td, anchor);
			append(td, input);

			if (!mounted) {
				dispose = listen(input, "click", /*HandleOnRowSelected*/ ctx[30]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*DataTable*/ 32 && input_checked_value !== (input_checked_value = /*RowIsSelected*/ ctx[18](/*dataRow*/ ctx[75].internal_hash_row))) {
				input.checked = input_checked_value;
			}

			if (dirty[0] & /*DataTable*/ 32 && input_data_internal_hash_row_value !== (input_data_internal_hash_row_value = /*dataRow*/ ctx[75].internal_hash_row)) {
				attr(input, "data-internal_hash_row", input_data_internal_hash_row_value);
			}
		},
		d(detaching) {
			if (detaching) detach(td);
			mounted = false;
			dispose();
		}
	};
}

// (626:12) {#if showEdit}
function create_if_block_9(ctx) {
	let td;
	let mounted;
	let dispose;

	return {
		c() {
			td = element("td");
			td.innerHTML = `<span class="icon is-small"><i class="fas fa-pen"></i></span>`;
			attr(td, "class", "has-text-centered show_cursor_mouse svelte-mc39ac");
		},
		m(target, anchor) {
			insert(target, td, anchor);

			if (!mounted) {
				dispose = listen(td, "click", function () {
					if (is_function(/*HClickEditRow*/ ctx[21](/*dataRow*/ ctx[75]))) /*HClickEditRow*/ ctx[21](/*dataRow*/ ctx[75]).apply(this, arguments);
				});

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
		},
		d(detaching) {
			if (detaching) detach(td);
			mounted = false;
			dispose();
		}
	};
}

// (638:14) {#if internal_columns[item]}
function create_if_block_6(ctx) {
	let if_block_anchor;
	let current;
	let if_block = (!/*internal_columns*/ ctx[15][/*item*/ ctx[78]].hidden || /*internal_columns*/ ctx[15][/*item*/ ctx[78]].hidden == null) && create_if_block_7(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (!/*internal_columns*/ ctx[15][/*item*/ ctx[78]].hidden || /*internal_columns*/ ctx[15][/*item*/ ctx[78]].hidden == null) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty[0] & /*internal_columns, DataTable*/ 32800) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block_7(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

// (639:16) {#if !internal_columns[item].hidden || internal_columns[item].hidden == null}
function create_if_block_7(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block_8, create_else_block];
	const if_blocks = [];

	function select_block_type_2(ctx, dirty) {
		if (/*internal_columns*/ ctx[15][/*item*/ ctx[78]].decorator) return 0;
		return 1;
	}

	current_block_type_index = select_block_type_2(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type_2(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

// (647:18) {:else}
function create_else_block(ctx) {
	let switch_instance;
	let switch_instance_anchor;
	let current;
	var switch_value = /*Json*/ ctx[16];

	function switch_props(ctx) {
		return {
			props: {
				row: /*dataRow*/ ctx[75],
				value: /*dataRow*/ ctx[75][/*item*/ ctx[78]]
			}
		};
	}

	if (switch_value) {
		switch_instance = new switch_value(switch_props(ctx));

		switch_instance.$on("click", function () {
			if (is_function(/*HClickCell*/ ctx[20](/*item*/ ctx[78], /*dataRow*/ ctx[75]))) /*HClickCell*/ ctx[20](/*item*/ ctx[78], /*dataRow*/ ctx[75]).apply(this, arguments);
		});
	}

	return {
		c() {
			if (switch_instance) create_component(switch_instance.$$.fragment);
			switch_instance_anchor = empty();
		},
		m(target, anchor) {
			if (switch_instance) {
				mount_component(switch_instance, target, anchor);
			}

			insert(target, switch_instance_anchor, anchor);
			current = true;
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			const switch_instance_changes = {};
			if (dirty[0] & /*DataTable*/ 32) switch_instance_changes.row = /*dataRow*/ ctx[75];
			if (dirty[0] & /*DataTable*/ 32) switch_instance_changes.value = /*dataRow*/ ctx[75][/*item*/ ctx[78]];

			if (switch_value !== (switch_value = /*Json*/ ctx[16])) {
				if (switch_instance) {
					group_outros();
					const old_component = switch_instance;

					transition_out(old_component.$$.fragment, 1, 0, () => {
						destroy_component(old_component, 1);
					});

					check_outros();
				}

				if (switch_value) {
					switch_instance = new switch_value(switch_props(ctx));

					switch_instance.$on("click", function () {
						if (is_function(/*HClickCell*/ ctx[20](/*item*/ ctx[78], /*dataRow*/ ctx[75]))) /*HClickCell*/ ctx[20](/*item*/ ctx[78], /*dataRow*/ ctx[75]).apply(this, arguments);
					});

					create_component(switch_instance.$$.fragment);
					transition_in(switch_instance.$$.fragment, 1);
					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
				} else {
					switch_instance = null;
				}
			} else if (switch_value) {
				switch_instance.$set(switch_instance_changes);
			}
		},
		i(local) {
			if (current) return;
			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
			current = true;
		},
		o(local) {
			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(switch_instance_anchor);
			if (switch_instance) destroy_component(switch_instance, detaching);
		}
	};
}

// (640:18) {#if internal_columns[item].decorator}
function create_if_block_8(ctx) {
	let switch_instance;
	let switch_instance_anchor;
	let current;
	var switch_value = /*internal_columns*/ ctx[15][/*item*/ ctx[78]].decorator;

	function switch_props(ctx) {
		return {
			props: {
				row: /*dataRow*/ ctx[75],
				value: /*dataRow*/ ctx[75][/*item*/ ctx[78]]
			}
		};
	}

	if (switch_value) {
		switch_instance = new switch_value(switch_props(ctx));

		switch_instance.$on("click", function () {
			if (is_function(/*HClickCell*/ ctx[20](/*item*/ ctx[78], /*dataRow*/ ctx[75]))) /*HClickCell*/ ctx[20](/*item*/ ctx[78], /*dataRow*/ ctx[75]).apply(this, arguments);
		});
	}

	return {
		c() {
			if (switch_instance) create_component(switch_instance.$$.fragment);
			switch_instance_anchor = empty();
		},
		m(target, anchor) {
			if (switch_instance) {
				mount_component(switch_instance, target, anchor);
			}

			insert(target, switch_instance_anchor, anchor);
			current = true;
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			const switch_instance_changes = {};
			if (dirty[0] & /*DataTable*/ 32) switch_instance_changes.row = /*dataRow*/ ctx[75];
			if (dirty[0] & /*DataTable*/ 32) switch_instance_changes.value = /*dataRow*/ ctx[75][/*item*/ ctx[78]];

			if (switch_value !== (switch_value = /*internal_columns*/ ctx[15][/*item*/ ctx[78]].decorator)) {
				if (switch_instance) {
					group_outros();
					const old_component = switch_instance;

					transition_out(old_component.$$.fragment, 1, 0, () => {
						destroy_component(old_component, 1);
					});

					check_outros();
				}

				if (switch_value) {
					switch_instance = new switch_value(switch_props(ctx));

					switch_instance.$on("click", function () {
						if (is_function(/*HClickCell*/ ctx[20](/*item*/ ctx[78], /*dataRow*/ ctx[75]))) /*HClickCell*/ ctx[20](/*item*/ ctx[78], /*dataRow*/ ctx[75]).apply(this, arguments);
					});

					create_component(switch_instance.$$.fragment);
					transition_in(switch_instance.$$.fragment, 1);
					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
				} else {
					switch_instance = null;
				}
			} else if (switch_value) {
				switch_instance.$set(switch_instance_changes);
			}
		},
		i(local) {
			if (current) return;
			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
			current = true;
		},
		o(local) {
			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(switch_instance_anchor);
			if (switch_instance) destroy_component(switch_instance, detaching);
		}
	};
}

// (636:12) {#each Object.keys(dataRow) as item, itd}
function create_each_block_2(ctx) {
	let if_block_anchor;
	let current;
	let if_block = /*internal_columns*/ ctx[15][/*item*/ ctx[78]] && create_if_block_6(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (/*internal_columns*/ ctx[15][/*item*/ ctx[78]]) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty[0] & /*internal_columns, DataTable*/ 32800) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block_6(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

// (598:8) {#each DataTable as dataRow, i (dataRow.internal_hash_row)}
function create_each_block_1(key_1, ctx) {
	let tr;
	let td;
	let t0_value = /*i*/ ctx[77] + 1 + /*RowsPerPage*/ ctx[11] * (/*PageSelected*/ ctx[10] - 1) + "";
	let t0;
	let t1;
	let t2;
	let t3;
	let t4;
	let t5;
	let current;
	let if_block0 = /*SelectionType*/ ctx[0] == 1 && create_if_block_11(ctx);
	let if_block1 = /*SelectionType*/ ctx[0] == 2 && create_if_block_10(ctx);
	let if_block2 = /*showEdit*/ ctx[8] && create_if_block_9(ctx);
	let each_value_2 = Object.keys(/*dataRow*/ ctx[75]);
	let each_blocks = [];

	for (let i = 0; i < each_value_2.length; i += 1) {
		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		key: key_1,
		first: null,
		c() {
			tr = element("tr");
			td = element("td");
			t0 = text(t0_value);
			t1 = space();
			if (if_block0) if_block0.c();
			t2 = space();
			if (if_block1) if_block1.c();
			t3 = space();
			if (if_block2) if_block2.c();
			t4 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t5 = space();
			this.first = tr;
		},
		m(target, anchor) {
			insert(target, tr, anchor);
			append(tr, td);
			append(td, t0);
			append(tr, t1);
			if (if_block0) if_block0.m(tr, null);
			append(tr, t2);
			if (if_block1) if_block1.m(tr, null);
			append(tr, t3);
			if (if_block2) if_block2.m(tr, null);
			append(tr, t4);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(tr, null);
			}

			append(tr, t5);
			current = true;
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if ((!current || dirty[0] & /*DataTable, RowsPerPage, PageSelected*/ 3104) && t0_value !== (t0_value = /*i*/ ctx[77] + 1 + /*RowsPerPage*/ ctx[11] * (/*PageSelected*/ ctx[10] - 1) + "")) set_data(t0, t0_value);

			if (/*SelectionType*/ ctx[0] == 1) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_11(ctx);
					if_block0.c();
					if_block0.m(tr, t2);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (/*SelectionType*/ ctx[0] == 2) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_10(ctx);
					if_block1.c();
					if_block1.m(tr, t3);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (/*showEdit*/ ctx[8]) {
				if (if_block2) {
					if_block2.p(ctx, dirty);
				} else {
					if_block2 = create_if_block_9(ctx);
					if_block2.c();
					if_block2.m(tr, t4);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if (dirty[0] & /*internal_columns, DataTable, HClickCell, Json*/ 1146912) {
				each_value_2 = Object.keys(/*dataRow*/ ctx[75]);
				let i;

				for (i = 0; i < each_value_2.length; i += 1) {
					const child_ctx = get_each_context_2(ctx, each_value_2, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block_2(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(tr, t5);
					}
				}

				group_outros();

				for (i = each_value_2.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value_2.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(tr);
			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			destroy_each(each_blocks, detaching);
		}
	};
}

// (668:8) {#if paginatedData && paginatedData.length > 1}
function create_if_block_1(ctx) {
	let div0;
	let span0;
	let t0;
	let t1;
	let t2;
	let t3;
	let t4;
	let t5;
	let t6;
	let t7;
	let div2;
	let div1;
	let button0;
	let t8;
	let button1;
	let t9;
	let button2;
	let t10;
	let t11;
	let t12;
	let t13;
	let t14;
	let t15;
	let button3;
	let t16;
	let button4;
	let mounted;
	let dispose;
	let if_block0 = /*PageSelected*/ ctx[10] + 1 <= /*TotalPages*/ ctx[13] && create_if_block_5(ctx);
	let if_block1 = /*PageSelected*/ ctx[10] + 2 <= /*TotalPages*/ ctx[13] && create_if_block_4(ctx);
	let if_block2 = /*PageSelected*/ ctx[10] + 3 <= /*TotalPages*/ ctx[13] && create_if_block_3(ctx);
	let if_block3 = /*PageSelected*/ ctx[10] + 4 <= /*TotalPages*/ ctx[13] && create_if_block_2(ctx);

	return {
		c() {
			div0 = element("div");
			span0 = element("span");
			t0 = text("Página ");
			t1 = text(/*PageSelected*/ ctx[10]);
			t2 = text(" de ");
			t3 = text(/*TotalPages*/ ctx[13]);
			t4 = text(" (Total ");
			t5 = text(/*totalFilteredRows*/ ctx[12]);
			t6 = text("\n              filas)");
			t7 = space();
			div2 = element("div");
			div1 = element("div");
			button0 = element("button");
			button0.innerHTML = `<span class="icon "><i class="fas fa-angle-double-left"></i></span>`;
			t8 = space();
			button1 = element("button");
			button1.innerHTML = `<span class="icon "><i class="fas fa-angle-left"></i></span>`;
			t9 = space();
			button2 = element("button");
			t10 = text(/*PageSelected*/ ctx[10]);
			t11 = space();
			if (if_block0) if_block0.c();
			t12 = space();
			if (if_block1) if_block1.c();
			t13 = space();
			if (if_block2) if_block2.c();
			t14 = space();
			if (if_block3) if_block3.c();
			t15 = space();
			button3 = element("button");
			button3.innerHTML = `<span class="icon"><i class="fas fa-angle-right"></i></span>`;
			t16 = space();
			button4 = element("button");
			button4.innerHTML = `<span class="icon"><i class="fas fa-angle-double-right"></i></span>`;
			attr(span0, "class", "");
			attr(div0, "class", "level-item");
			attr(button0, "class", "button is-small");
			attr(button1, "class", "button is-small");
			attr(button2, "class", "button is-small is-info");
			attr(button3, "class", "button is-small");
			attr(button4, "class", "button is-small");
			attr(div1, "class", "buttons has-addons");
			attr(div2, "class", "level-item");
		},
		m(target, anchor) {
			insert(target, div0, anchor);
			append(div0, span0);
			append(span0, t0);
			append(span0, t1);
			append(span0, t2);
			append(span0, t3);
			append(span0, t4);
			append(span0, t5);
			append(span0, t6);
			insert(target, t7, anchor);
			insert(target, div2, anchor);
			append(div2, div1);
			append(div1, button0);
			append(div1, t8);
			append(div1, button1);
			append(div1, t9);
			append(div1, button2);
			append(button2, t10);
			append(div1, t11);
			if (if_block0) if_block0.m(div1, null);
			append(div1, t12);
			if (if_block1) if_block1.m(div1, null);
			append(div1, t13);
			if (if_block2) if_block2.m(div1, null);
			append(div1, t14);
			if (if_block3) if_block3.m(div1, null);
			append(div1, t15);
			append(div1, button3);
			append(div1, t16);
			append(div1, button4);

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*click_handler*/ ctx[43]),
					listen(button1, "click", /*click_handler_1*/ ctx[44]),
					listen(button2, "click", /*click_handler_2*/ ctx[45]),
					listen(button3, "click", /*click_handler_7*/ ctx[50]),
					listen(button4, "click", /*click_handler_8*/ ctx[51])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*PageSelected*/ 1024) set_data(t1, /*PageSelected*/ ctx[10]);
			if (dirty[0] & /*TotalPages*/ 8192) set_data(t3, /*TotalPages*/ ctx[13]);
			if (dirty[0] & /*totalFilteredRows*/ 4096) set_data(t5, /*totalFilteredRows*/ ctx[12]);
			if (dirty[0] & /*PageSelected*/ 1024) set_data(t10, /*PageSelected*/ ctx[10]);

			if (/*PageSelected*/ ctx[10] + 1 <= /*TotalPages*/ ctx[13]) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_5(ctx);
					if_block0.c();
					if_block0.m(div1, t12);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (/*PageSelected*/ ctx[10] + 2 <= /*TotalPages*/ ctx[13]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_4(ctx);
					if_block1.c();
					if_block1.m(div1, t13);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (/*PageSelected*/ ctx[10] + 3 <= /*TotalPages*/ ctx[13]) {
				if (if_block2) {
					if_block2.p(ctx, dirty);
				} else {
					if_block2 = create_if_block_3(ctx);
					if_block2.c();
					if_block2.m(div1, t14);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if (/*PageSelected*/ ctx[10] + 4 <= /*TotalPages*/ ctx[13]) {
				if (if_block3) {
					if_block3.p(ctx, dirty);
				} else {
					if_block3 = create_if_block_2(ctx);
					if_block3.c();
					if_block3.m(div1, t15);
				}
			} else if (if_block3) {
				if_block3.d(1);
				if_block3 = null;
			}
		},
		d(detaching) {
			if (detaching) detach(div0);
			if (detaching) detach(t7);
			if (detaching) detach(div2);
			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			if (if_block3) if_block3.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

// (708:14) {#if PageSelected + 1 <= TotalPages}
function create_if_block_5(ctx) {
	let button;
	let t_value = /*PageSelected*/ ctx[10] + 1 + "";
	let t;
	let mounted;
	let dispose;

	return {
		c() {
			button = element("button");
			t = text(t_value);
			attr(button, "class", "button is-small");
		},
		m(target, anchor) {
			insert(target, button, anchor);
			append(button, t);

			if (!mounted) {
				dispose = listen(button, "click", /*click_handler_3*/ ctx[46]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*PageSelected*/ 1024 && t_value !== (t_value = /*PageSelected*/ ctx[10] + 1 + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

// (717:14) {#if PageSelected + 2 <= TotalPages}
function create_if_block_4(ctx) {
	let button;
	let t_value = /*PageSelected*/ ctx[10] + 2 + "";
	let t;
	let mounted;
	let dispose;

	return {
		c() {
			button = element("button");
			t = text(t_value);
			attr(button, "class", "button is-small");
		},
		m(target, anchor) {
			insert(target, button, anchor);
			append(button, t);

			if (!mounted) {
				dispose = listen(button, "click", /*click_handler_4*/ ctx[47]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*PageSelected*/ 1024 && t_value !== (t_value = /*PageSelected*/ ctx[10] + 2 + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

// (727:14) {#if PageSelected + 3 <= TotalPages}
function create_if_block_3(ctx) {
	let button;
	let t_value = /*PageSelected*/ ctx[10] + 3 + "";
	let t;
	let mounted;
	let dispose;

	return {
		c() {
			button = element("button");
			t = text(t_value);
			attr(button, "class", "button is-small");
		},
		m(target, anchor) {
			insert(target, button, anchor);
			append(button, t);

			if (!mounted) {
				dispose = listen(button, "click", /*click_handler_5*/ ctx[48]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*PageSelected*/ 1024 && t_value !== (t_value = /*PageSelected*/ ctx[10] + 3 + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

// (737:14) {#if PageSelected + 4 <= TotalPages}
function create_if_block_2(ctx) {
	let button;
	let t_value = /*PageSelected*/ ctx[10] + 4 + "";
	let t;
	let mounted;
	let dispose;

	return {
		c() {
			button = element("button");
			t = text(t_value);
			attr(button, "class", "button is-small");
		},
		m(target, anchor) {
			insert(target, button, anchor);
			append(button, t);

			if (!mounted) {
				dispose = listen(button, "click", /*click_handler_6*/ ctx[49]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*PageSelected*/ 1024 && t_value !== (t_value = /*PageSelected*/ ctx[10] + 4 + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

// (827:8) {#each Object.keys(columns) as col}
function create_each_block(ctx) {
	let div;
	let label;
	let input;
	let t0;
	let t1_value = /*col*/ ctx[72] + "";
	let t1;
	let t2;

	return {
		c() {
			div = element("div");
			label = element("label");
			input = element("input");
			t0 = space();
			t1 = text(t1_value);
			t2 = space();
			attr(input, "type", "checkbox");
			attr(label, "class", "checkbox");
			attr(div, "class", "column");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, label);
			append(label, input);
			append(label, t0);
			append(label, t1);
			append(div, t2);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*columns*/ 4 && t1_value !== (t1_value = /*col*/ ctx[72] + "")) set_data(t1, t1_value);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

function create_fragment(ctx) {
	let nav;
	let div1;
	let div0;
	let span0;
	let t0;
	let div11;
	let div2;
	let button0;
	let span1;
	let t1;
	let span2;
	let t2_value = /*IntervalRefresh*/ ctx[17][/*IntervalRefreshSelected*/ ctx[1]] + "";
	let t2;
	let t3;
	let t4;
	let t5;
	let t6;
	let t7;
	let t8;
	let t9;
	let t10;
	let t11;
	let div7;
	let div6;
	let div3;
	let t12;
	let div5;
	let div4;
	let a0;
	let input0;
	let t13;
	let span4;
	let t14;
	let span5;
	let t16;
	let a1;
	let input1;
	let t17;
	let span6;
	let t18;
	let span7;
	let t20;
	let hr;
	let t21;
	let a2;
	let input2;
	let t22;
	let span8;
	let t23;
	let span9;
	let t25;
	let div8;
	let button2;
	let t26;
	let div10;
	let div9;
	let p0;
	let input3;
	let t27;
	let p1;
	let button3;
	let t28;
	let current_block_type_index;
	let if_block8;
	let t29;
	let div15;
	let div12;
	let t30;
	let div14;
	let header;
	let p2;
	let t32;
	let button4;
	let t33;
	let section;
	let div13;
	let t34;
	let footer;
	let button5;
	let t36;
	let button6;
	let current;
	let mounted;
	let dispose;
	const title_slot_template = /*#slots*/ ctx[38].title;
	const title_slot = create_slot(title_slot_template, ctx, /*$$scope*/ ctx[37], get_title_slot_context);
	const title_slot_or_fallback = title_slot || fallback_block();

	function select_block_type(ctx, dirty) {
		if (/*loading*/ ctx[7]) return create_if_block_24;
		return create_else_block_2;
	}

	let current_block_type = select_block_type(ctx);
	let if_block0 = current_block_type(ctx);
	let if_block1 = /*$$slots*/ ctx[31].item1 && create_if_block_23(ctx);
	let if_block2 = /*$$slots*/ ctx[31].item2 && create_if_block_22(ctx);
	let if_block3 = /*$$slots*/ ctx[31].item3 && create_if_block_21(ctx);
	let if_block4 = /*$$slots*/ ctx[31].item4 && create_if_block_20(ctx);
	let if_block5 = /*$$slots*/ ctx[31].item5 && create_if_block_19(ctx);
	let if_block6 = /*ShowNewButton*/ ctx[3] && create_if_block_18(ctx);
	let if_block7 = /*ShowEditButton*/ ctx[4] && create_if_block_17(ctx);
	const if_block_creators = [create_if_block, create_else_block_1];
	const if_blocks = [];

	function select_block_type_1(ctx, dirty) {
		if (/*DataTable*/ ctx[5] && /*DataTable*/ ctx[5].length > 0) return 0;
		return 1;
	}

	current_block_type_index = select_block_type_1(ctx);
	if_block8 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
	let each_value = Object.keys(/*columns*/ ctx[2]);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			nav = element("nav");
			div1 = element("div");
			div0 = element("div");
			span0 = element("span");
			if (title_slot_or_fallback) title_slot_or_fallback.c();
			t0 = space();
			div11 = element("div");
			div2 = element("div");
			button0 = element("button");
			span1 = element("span");
			if_block0.c();
			t1 = space();
			span2 = element("span");
			t2 = text(t2_value);
			t3 = text("s");
			t4 = space();
			if (if_block1) if_block1.c();
			t5 = space();
			if (if_block2) if_block2.c();
			t6 = space();
			if (if_block3) if_block3.c();
			t7 = space();
			if (if_block4) if_block4.c();
			t8 = space();
			if (if_block5) if_block5.c();
			t9 = space();
			if (if_block6) if_block6.c();
			t10 = space();
			if (if_block7) if_block7.c();
			t11 = space();
			div7 = element("div");
			div6 = element("div");
			div3 = element("div");
			div3.innerHTML = `<button class="button is-small" aria-haspopup="true" aria-controls="dropdown-menu"><span class="icon"><i class="far fa-list-alt"></i></span></button>`;
			t12 = space();
			div5 = element("div");
			div4 = element("div");
			a0 = element("a");
			input0 = element("input");
			t13 = space();
			span4 = element("span");
			span4.innerHTML = `<i class="fas fa-check"></i>`;
			t14 = space();
			span5 = element("span");
			span5.textContent = "Simple";
			t16 = space();
			a1 = element("a");
			input1 = element("input");
			t17 = space();
			span6 = element("span");
			span6.innerHTML = `<i class="fas fa-check-double"></i>`;
			t18 = space();
			span7 = element("span");
			span7.textContent = "Multiple";
			t20 = space();
			hr = element("hr");
			t21 = space();
			a2 = element("a");
			input2 = element("input");
			t22 = space();
			span8 = element("span");
			span8.innerHTML = `<i class="fas fa-ban"></i>`;
			t23 = space();
			span9 = element("span");
			span9.textContent = "Ninguno";
			t25 = space();
			div8 = element("div");
			button2 = element("button");
			button2.innerHTML = `<span class="icon"><i class="far fa-file-excel"></i></span>`;
			t26 = space();
			div10 = element("div");
			div9 = element("div");
			p0 = element("p");
			input3 = element("input");
			t27 = space();
			p1 = element("p");
			button3 = element("button");
			button3.innerHTML = `<i class="fas fa-search"></i>`;
			t28 = space();
			if_block8.c();
			t29 = space();
			div15 = element("div");
			div12 = element("div");
			t30 = space();
			div14 = element("div");
			header = element("header");
			p2 = element("p");
			p2.innerHTML = `<b><span>Columnas</span></b>`;
			t32 = space();
			button4 = element("button");
			t33 = space();
			section = element("section");
			div13 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t34 = space();
			footer = element("footer");
			button5 = element("button");
			button5.innerHTML = `<span>Aceptar</span>`;
			t36 = space();
			button6 = element("button");
			button6.innerHTML = `<span>Cancelar</span>`;
			attr(span0, "class", "margin_title svelte-mc39ac");
			attr(div0, "class", "level-item");
			attr(div1, "class", "level-left");
			attr(span1, "class", "icon");
			attr(button0, "class", "button is-small");
			attr(div2, "class", "level-item");
			attr(div2, "title", "Intervalo de refresco");
			attr(div3, "class", "dropdown-trigger");
			attr(input0, "class", "check_margin svelte-mc39ac");
			attr(input0, "type", "radio");
			attr(input0, "name", "selection_type");
			input0.value = "1";
			input0.checked = true;
			attr(span4, "class", "icon");
			attr(a0, "class", "dropdown-item is-size-7");
			attr(input1, "class", "check_margin svelte-mc39ac");
			attr(input1, "type", "radio");
			attr(input1, "name", "selection_type");
			input1.value = "2";
			input1.checked = true;
			attr(span6, "class", "icon");
			attr(a1, "class", "dropdown-item is-size-7");
			attr(hr, "class", "dropdown-divider");
			attr(input2, "class", "check_margin svelte-mc39ac");
			attr(input2, "type", "radio");
			attr(input2, "name", "selection_type");
			input2.value = "0";
			input2.checked = true;
			attr(span8, "class", "icon");
			attr(a2, "class", "dropdown-item is-size-7");
			attr(div4, "class", "dropdown-content");
			attr(div5, "class", "dropdown-menu");
			attr(div5, "role", "menu");
			attr(div6, "class", "dropdown is-hoverable is-right");
			attr(div7, "class", "level-item");
			attr(div7, "title", "Selección");
			attr(button2, "class", "button is-small");
			attr(div8, "class", "level-item");
			attr(div8, "title", "Exportar Datos");
			attr(input3, "class", "input size_search is-small svelte-mc39ac");
			attr(input3, "type", "text");
			attr(input3, "placeholder", "Buscar");
			attr(p0, "class", "control");
			attr(button3, "class", "button is-small");
			attr(p1, "class", "control");
			attr(div9, "class", "field has-addons");
			attr(div10, "class", "level-item");
			attr(div11, "class", "level-right");
			attr(nav, "class", "level");
			attr(div12, "class", "modal-background");
			attr(p2, "class", "modal-card-title has-text-white");
			attr(button4, "class", "delete");
			attr(button4, "aria-label", "close");
			attr(header, "class", "modal-card-head has-background-dark");
			attr(div13, "class", "columns");
			attr(section, "class", "modal-card-body");
			attr(button5, "class", "button is-success is-small");
			attr(button6, "class", "button is-small");
			attr(footer, "class", "modal-card-foot has-background-dark");
			attr(div14, "class", "modal-card");
			attr(div15, "class", "modal");
			toggle_class(div15, "is-active", /*ShowDialogColumn*/ ctx[9]);
		},
		m(target, anchor) {
			insert(target, nav, anchor);
			append(nav, div1);
			append(div1, div0);
			append(div0, span0);

			if (title_slot_or_fallback) {
				title_slot_or_fallback.m(span0, null);
			}

			append(nav, t0);
			append(nav, div11);
			append(div11, div2);
			append(div2, button0);
			append(button0, span1);
			if_block0.m(span1, null);
			append(button0, t1);
			append(button0, span2);
			append(span2, t2);
			append(span2, t3);
			append(div11, t4);
			if (if_block1) if_block1.m(div11, null);
			append(div11, t5);
			if (if_block2) if_block2.m(div11, null);
			append(div11, t6);
			if (if_block3) if_block3.m(div11, null);
			append(div11, t7);
			if (if_block4) if_block4.m(div11, null);
			append(div11, t8);
			if (if_block5) if_block5.m(div11, null);
			append(div11, t9);
			if (if_block6) if_block6.m(div11, null);
			append(div11, t10);
			if (if_block7) if_block7.m(div11, null);
			append(div11, t11);
			append(div11, div7);
			append(div7, div6);
			append(div6, div3);
			append(div6, t12);
			append(div6, div5);
			append(div5, div4);
			append(div4, a0);
			append(a0, input0);
			append(a0, t13);
			append(a0, span4);
			append(a0, t14);
			append(a0, span5);
			append(div4, t16);
			append(div4, a1);
			append(a1, input1);
			append(a1, t17);
			append(a1, span6);
			append(a1, t18);
			append(a1, span7);
			append(div4, t20);
			append(div4, hr);
			append(div4, t21);
			append(div4, a2);
			append(a2, input2);
			append(a2, t22);
			append(a2, span8);
			append(a2, t23);
			append(a2, span9);
			append(div11, t25);
			append(div11, div8);
			append(div8, button2);
			append(div11, t26);
			append(div11, div10);
			append(div10, div9);
			append(div9, p0);
			append(p0, input3);
			set_input_value(input3, /*text_search*/ ctx[6]);
			append(div9, t27);
			append(div9, p1);
			append(p1, button3);
			insert(target, t28, anchor);
			if_blocks[current_block_type_index].m(target, anchor);
			insert(target, t29, anchor);
			insert(target, div15, anchor);
			append(div15, div12);
			append(div15, t30);
			append(div15, div14);
			append(div14, header);
			append(header, p2);
			append(header, t32);
			append(header, button4);
			append(div14, t33);
			append(div14, section);
			append(section, div13);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div13, null);
			}

			append(div14, t34);
			append(div14, footer);
			append(footer, button5);
			append(footer, t36);
			append(footer, button6);
			current = true;

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*ChangeIntervalRefresh*/ ctx[19]),
					listen(input0, "change", /*change_handler*/ ctx[39]),
					listen(input1, "change", /*change_handler_1*/ ctx[40]),
					listen(input2, "change", /*change_handler_2*/ ctx[41]),
					listen(button2, "click", /*handleExportSelection*/ ctx[26]),
					listen(input3, "input", /*input3_input_handler*/ ctx[42]),
					listen(button3, "click", /*handleClickSearch*/ ctx[24]),
					listen(button4, "click", /*click_handler_9*/ ctx[54]),
					listen(button6, "click", /*click_handler_10*/ ctx[55])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (title_slot) {
				if (title_slot.p && (!current || dirty[1] & /*$$scope*/ 64)) {
					update_slot_base(
						title_slot,
						title_slot_template,
						ctx,
						/*$$scope*/ ctx[37],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[37])
						: get_slot_changes(title_slot_template, /*$$scope*/ ctx[37], dirty, get_title_slot_changes),
						get_title_slot_context
					);
				}
			}

			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
				if_block0.d(1);
				if_block0 = current_block_type(ctx);

				if (if_block0) {
					if_block0.c();
					if_block0.m(span1, null);
				}
			}

			if ((!current || dirty[0] & /*IntervalRefreshSelected*/ 2) && t2_value !== (t2_value = /*IntervalRefresh*/ ctx[17][/*IntervalRefreshSelected*/ ctx[1]] + "")) set_data(t2, t2_value);

			if (/*$$slots*/ ctx[31].item1) {
				if (if_block1) {
					if_block1.p(ctx, dirty);

					if (dirty[1] & /*$$slots*/ 1) {
						transition_in(if_block1, 1);
					}
				} else {
					if_block1 = create_if_block_23(ctx);
					if_block1.c();
					transition_in(if_block1, 1);
					if_block1.m(div11, t5);
				}
			} else if (if_block1) {
				group_outros();

				transition_out(if_block1, 1, 1, () => {
					if_block1 = null;
				});

				check_outros();
			}

			if (/*$$slots*/ ctx[31].item2) {
				if (if_block2) {
					if_block2.p(ctx, dirty);

					if (dirty[1] & /*$$slots*/ 1) {
						transition_in(if_block2, 1);
					}
				} else {
					if_block2 = create_if_block_22(ctx);
					if_block2.c();
					transition_in(if_block2, 1);
					if_block2.m(div11, t6);
				}
			} else if (if_block2) {
				group_outros();

				transition_out(if_block2, 1, 1, () => {
					if_block2 = null;
				});

				check_outros();
			}

			if (/*$$slots*/ ctx[31].item3) {
				if (if_block3) {
					if_block3.p(ctx, dirty);

					if (dirty[1] & /*$$slots*/ 1) {
						transition_in(if_block3, 1);
					}
				} else {
					if_block3 = create_if_block_21(ctx);
					if_block3.c();
					transition_in(if_block3, 1);
					if_block3.m(div11, t7);
				}
			} else if (if_block3) {
				group_outros();

				transition_out(if_block3, 1, 1, () => {
					if_block3 = null;
				});

				check_outros();
			}

			if (/*$$slots*/ ctx[31].item4) {
				if (if_block4) {
					if_block4.p(ctx, dirty);

					if (dirty[1] & /*$$slots*/ 1) {
						transition_in(if_block4, 1);
					}
				} else {
					if_block4 = create_if_block_20(ctx);
					if_block4.c();
					transition_in(if_block4, 1);
					if_block4.m(div11, t8);
				}
			} else if (if_block4) {
				group_outros();

				transition_out(if_block4, 1, 1, () => {
					if_block4 = null;
				});

				check_outros();
			}

			if (/*$$slots*/ ctx[31].item5) {
				if (if_block5) {
					if_block5.p(ctx, dirty);

					if (dirty[1] & /*$$slots*/ 1) {
						transition_in(if_block5, 1);
					}
				} else {
					if_block5 = create_if_block_19(ctx);
					if_block5.c();
					transition_in(if_block5, 1);
					if_block5.m(div11, t9);
				}
			} else if (if_block5) {
				group_outros();

				transition_out(if_block5, 1, 1, () => {
					if_block5 = null;
				});

				check_outros();
			}

			if (/*ShowNewButton*/ ctx[3]) {
				if (if_block6) {
					if_block6.p(ctx, dirty);
				} else {
					if_block6 = create_if_block_18(ctx);
					if_block6.c();
					if_block6.m(div11, t10);
				}
			} else if (if_block6) {
				if_block6.d(1);
				if_block6 = null;
			}

			if (/*ShowEditButton*/ ctx[4]) {
				if (if_block7) {
					if_block7.p(ctx, dirty);
				} else {
					if_block7 = create_if_block_17(ctx);
					if_block7.c();
					if_block7.m(div11, t11);
				}
			} else if (if_block7) {
				if_block7.d(1);
				if_block7 = null;
			}

			if (dirty[0] & /*text_search*/ 64 && input3.value !== /*text_search*/ ctx[6]) {
				set_input_value(input3, /*text_search*/ ctx[6]);
			}

			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type_1(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block8 = if_blocks[current_block_type_index];

				if (!if_block8) {
					if_block8 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block8.c();
				} else {
					if_block8.p(ctx, dirty);
				}

				transition_in(if_block8, 1);
				if_block8.m(t29.parentNode, t29);
			}

			if (dirty[0] & /*columns*/ 4) {
				each_value = Object.keys(/*columns*/ ctx[2]);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div13, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}

			if (dirty[0] & /*ShowDialogColumn*/ 512) {
				toggle_class(div15, "is-active", /*ShowDialogColumn*/ ctx[9]);
			}
		},
		i(local) {
			if (current) return;
			transition_in(title_slot_or_fallback, local);
			transition_in(if_block1);
			transition_in(if_block2);
			transition_in(if_block3);
			transition_in(if_block4);
			transition_in(if_block5);
			transition_in(if_block8);
			current = true;
		},
		o(local) {
			transition_out(title_slot_or_fallback, local);
			transition_out(if_block1);
			transition_out(if_block2);
			transition_out(if_block3);
			transition_out(if_block4);
			transition_out(if_block5);
			transition_out(if_block8);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(nav);
			if (title_slot_or_fallback) title_slot_or_fallback.d(detaching);
			if_block0.d();
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			if (if_block3) if_block3.d();
			if (if_block4) if_block4.d();
			if (if_block5) if_block5.d();
			if (if_block6) if_block6.d();
			if (if_block7) if_block7.d();
			if (detaching) detach(t28);
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach(t29);
			if (detaching) detach(div15);
			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

function ArrayChunk(myArray, chunk_size) {
	var index = 0;
	var arrayLength = myArray.length;
	var tempArray = [];
	chunk_size = parseInt(chunk_size);

	for (index = 0; index < arrayLength; index += chunk_size) {
		let myChunk = myArray.slice(index, index + chunk_size);

		// Do something if you want with the group
		tempArray.push(myChunk);
	}

	return tempArray;
}

function SortColumn(key, order = "asc") {
	return function innerSort(a, b) {
		if (!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) {
			return 0;
		}

		const varA = typeof a[key] === "string"
		? a[key].toUpperCase()
		: a[key];

		const varB = typeof b[key] === "string"
		? b[key].toUpperCase()
		: b[key];

		let comparison = 0;

		if (varA > varB) {
			comparison = 1;
		} else if (varA < varB) {
			comparison = -1;
		}

		return order === "desc" ? comparison * -1 : comparison;
	};
}

function instance($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	const $$slots = compute_slots(slots);
	const crypto = require("crypto");
	const XLSX = require("xlsx");
	const uFetch = require("@edwinspire/universal-fetch");
	const Json = require("./Column/DefaultTypes.js").Json;
	let { RawDataTable = [] } = $$props;
	let { SelectionType = 0 } = $$props;
	let { columns = {} } = $$props;
	let { url = "" } = $$props;
	let { params = {} } = $$props;
	let { ShowNewButton = false } = $$props;
	let { ShowEditButton = false } = $$props;
	const FetchData = new uFetch();
	const dispatch = createEventDispatcher();
	let DataTable = [];
	let SelectedRows = [];
	let text_search;
	let loading = false;
	let showEdit = false;
	let ColumnSort;
	let ShowDialogColumn = false;

	// -- Refresh -- //
	let IntervalRefresh = [10, 20, 30, 45, 60, 120, 240, 480, 960, 1920, 3840];

	let { IntervalRefreshSelected = 2 } = $$props;

	//-- Pagination --//
	let PageSelected = 1;

	let RowsPerPage = 20;
	let totalFilteredRows = 0;
	let TotalPages = 0;
	let paginatedData = [];
	let SelectAll = false;
	let orderASC = true;
	let internal_columns = {};

	function OnSelection() {
		dispatch("selectrows", { rows: GetSelectedRows() });
	}

	onMount(() => {
		GetDataTable();
	});

	function SetColumns() {
		if (RawDataTable && RawDataTable.length > 0) {
			let MaxSizeLabel = 15;
			$$invalidate(15, internal_columns = {});

			Object.keys(RawDataTable[0]).forEach(item => {
				if (item === "internal_hash_row") {
					$$invalidate(
						15,
						internal_columns[item] = {
							label: item.substring(0, MaxSizeLabel),
							hidden: true
						},
						internal_columns
					);
				} else if (columns[item]) {
					$$invalidate(15, internal_columns[item] = columns[item], internal_columns);

					if (!internal_columns[item].label) {
						$$invalidate(15, internal_columns[item].label = item.substring(0, MaxSizeLabel), internal_columns);
					}
				} else {
					// Tambien limita la longitud del nombre de la columna a 10 caracteres
					$$invalidate(
						15,
						internal_columns[item] = {
							label: item.substring(0, MaxSizeLabel),
							hidden: false
						},
						internal_columns
					);
				}
			});
		}
	} //console.log(internal_columns);

	function RowIsSelected(internal_hash_row) {
		let isSelected = SelectedRows.includes(internal_hash_row);
		return isSelected;
	}

	function GetSelectedRows() {
		return RawDataTable.filter(row => {
			return SelectedRows.includes(row.internal_hash_row);
		});
	}

	function ExportTable() {
		try {
			// Filter only selection
			let filteredData = GetSelectedRows();

			let FormatedData = filteredData.map(row => {
				let r = { ...row };

				// Convert to string objects
				Object.keys(row).forEach(key => {
					if (columns[key] && columns[key].type == "Date") {
						r[key] = new Date(row[key]).toString();
					} else if (row[key] !== null && typeof row[key] === "object") {
						r[key] = JSON.stringify(row[key], null, 4);
					}
				});

				delete r.internal_hash_row;
				return r;
			});

			if (FormatedData && FormatedData.length > 0) {
				/* Create a worksheet */
				var ws = XLSX.utils.json_to_sheet(FormatedData);

				/* Create a new empty workbook, then add the worksheet */
				var wb = XLSX.utils.book_new();

				XLSX.utils.book_append_sheet(wb, ws, "Report");
				XLSX.writeFile(wb, "Table_" + Date.now() + ".xlsx");
			} else {
				alert("Debe Seleccionar las filas para exportar");
				$$invalidate(0, SelectionType = 2);
			}
		} catch(error) {
			console.error(error);
		}
	}

	let auto_refresh = setInterval(
		() => {
			GetDataTable();
		},
		IntervalRefresh[IntervalRefreshSelected] * 1000
	);

	onDestroy(() => {
		console.log("Mata refresh");
		clearInterval(auto_refresh);
	});

	function ChangeIntervalRefresh() {
		let i = IntervalRefreshSelected + 1;

		if (IntervalRefresh[i]) {
			$$invalidate(1, IntervalRefreshSelected = i);
		} else {
			$$invalidate(1, IntervalRefreshSelected = 0);
		}

		clearInterval(auto_refresh);

		auto_refresh = setInterval(
			() => {
				GetDataTable();
			},
			IntervalRefresh[IntervalRefreshSelected] * 1000 + 100
		);
	}

	function HClickCell(cell, row) {
		dispatch("clickrow", { field: cell, data: row });
	}

	function HClickEditRow(e) {
		dispatch("editrow", { data: e });
	}

	function HClickNew(e) {
		dispatch("newrow", e);
	}

	function HClickHeader(e) {
		ColumnSort = e.target.dataset.column;
		orderASC = !orderASC;
		FilterData();
	}

	function handleClickSearch() {
		if (text_search && text_search.length > 0) {
			FilterData();
		} else {
			GetDataTable();
		}
	}

	GetDataTable();

	function handleChangeSelectAll(e) {
		SelectAll = e.target.checked;

		if (SelectAll) {
			$$invalidate(36, SelectedRows = []);

			paginatedData.forEach(pag => {
				$$invalidate(36, SelectedRows = SelectedRows.concat(pag.map(item => {
					return item.internal_hash_row;
				})));
			});
		} else {
			$$invalidate(36, SelectedRows = []);
		}

		//console.log(SelectedRows);
		FilterData();
	}

	function handleExportSelection(e) {
		ExportTable();
	}

	function FilterData() {
		//console.log("Filtrar", text_search);
		let TempData;

		if (text_search && text_search.length > 0) {
			TempData = RawDataTable.filter(d => {
				let s = Object.values(d).filter(item => {
					if (item) {
						return item.toString().toUpperCase().includes(text_search.toUpperCase());
					} else {
						return item;
					}
				});

				if (s.length > 0) {
					return true;
				} else {
					return false;
				}
			});
		} else {
			TempData = RawDataTable;
		}

		$$invalidate(12, totalFilteredRows = TempData.length);
		Pagination(TempData);
	}

	function Pagination(rows) {
		if (ColumnSort) {
			if (orderASC) {
				rows = rows.sort(SortColumn(ColumnSort));
			} else {
				rows = rows.sort(SortColumn(ColumnSort, "desc"));
			}
		}

		$$invalidate(14, paginatedData = ArrayChunk(rows, RowsPerPage));
		$$invalidate(13, TotalPages = paginatedData.length);

		if (PageSelected > TotalPages) {
			$$invalidate(10, PageSelected = 1);
		}

		SelectPage();
	}

	function SelectPage() {
		$$invalidate(5, DataTable = paginatedData[PageSelected - 1]);
	}

	function HandleOnClickEdit() {
		console.log(showEdit);
		$$invalidate(8, showEdit = !showEdit);
		return false;
	}

	function HandleOnRowSelected(event) {
		if (SelectionType == 1) {
			$$invalidate(36, SelectedRows = []);
		}

		let internal_hash_row = event.target.dataset.internal_hash_row;

		if (event.target.checked) {
			SelectedRows.push(internal_hash_row);
		} else {
			$$invalidate(36, SelectedRows = SelectedRows.filter(value => {
				return value !== internal_hash_row;
			}));
		}

		OnSelection();
	}

	async function GetDataTable() {
		if (loading) {
			console.log("Hay una petición en curso");
		} else {
			if (url && url.length > 0) {
				try {
					$$invalidate(7, loading = true);
					let res = await FetchData.get(url, params);

					if (res && res.ok) {
						let data = await res.json();

						if (Array.isArray(data)) {
							$$invalidate(32, RawDataTable = data);
						} else {
							console.warn(data);
							$$invalidate(32, RawDataTable = []);
						}
					} else {
						console.error(res);
					}

					let Listinternal_hash_row = {}; // Esta variable se usa unicamente para verificar que no se generen llaves duplicadas

					$$invalidate(32, RawDataTable = RawDataTable.map(row => {
						let c = crypto.createHash("md5").update(JSON.stringify(row)).digest("base64");

						if (Listinternal_hash_row[c]) {
							console.error("Hay un registro duplicado en la tabla", row);
							c = c + "-" + new Date().getTime() + "-" + Math.floor(Math.random() * 10000);
							Listinternal_hash_row[c] = true;
						} else {
							Listinternal_hash_row[c] = true;
						}

						return { ...row, internal_hash_row: c };
					}));

					//console.log(RawDataTable);
					SetColumns();

					FilterData();
					$$invalidate(7, loading = false);
				} catch(error) {
					console.error(error);
					$$invalidate(7, loading = false);
				}
			} else {
				console.warn("Not url asigned");
			}
		}
	}

	const change_handler = () => {
		$$invalidate(0, SelectionType = 1);
	};

	const change_handler_1 = () => {
		$$invalidate(0, SelectionType = 2);
	};

	const change_handler_2 = () => {
		$$invalidate(0, SelectionType = 0);
	};

	function input3_input_handler() {
		text_search = this.value;
		$$invalidate(6, text_search);
	}

	const click_handler = () => {
		$$invalidate(10, PageSelected = 1);
		SelectPage();
	};

	const click_handler_1 = () => {
		if (PageSelected > 1) {
			$$invalidate(10, PageSelected = PageSelected - 1);
		}

		SelectPage();
	};

	const click_handler_2 = () => {
		//PageSelected = 1;
		SelectPage();
	};

	const click_handler_3 = () => {
		$$invalidate(10, PageSelected = PageSelected + 1);
		SelectPage();
	};

	const click_handler_4 = () => {
		$$invalidate(10, PageSelected = PageSelected + 2);
		SelectPage();
	};

	const click_handler_5 = () => {
		$$invalidate(10, PageSelected = PageSelected + 3);
		SelectPage();
	};

	const click_handler_6 = () => {
		$$invalidate(10, PageSelected = PageSelected + 4);
		SelectPage();
	};

	const click_handler_7 = () => {
		if (PageSelected < TotalPages) {
			$$invalidate(10, PageSelected = PageSelected + 1);
			SelectPage();
		}
	};

	const click_handler_8 = () => {
		$$invalidate(10, PageSelected = TotalPages);
		SelectPage();
	};

	function select_change_handler() {
		RowsPerPage = select_value(this);
		$$invalidate(11, RowsPerPage);
	}

	const change_handler_3 = () => {
		FilterData();
	};

	const click_handler_9 = e => {
		$$invalidate(9, ShowDialogColumn = false);
	};

	const click_handler_10 = e => {
		$$invalidate(9, ShowDialogColumn = false);
	};

	$$self.$$set = $$props => {
		if ('RawDataTable' in $$props) $$invalidate(32, RawDataTable = $$props.RawDataTable);
		if ('SelectionType' in $$props) $$invalidate(0, SelectionType = $$props.SelectionType);
		if ('columns' in $$props) $$invalidate(2, columns = $$props.columns);
		if ('url' in $$props) $$invalidate(33, url = $$props.url);
		if ('params' in $$props) $$invalidate(34, params = $$props.params);
		if ('ShowNewButton' in $$props) $$invalidate(3, ShowNewButton = $$props.ShowNewButton);
		if ('ShowEditButton' in $$props) $$invalidate(4, ShowEditButton = $$props.ShowEditButton);
		if ('IntervalRefreshSelected' in $$props) $$invalidate(1, IntervalRefreshSelected = $$props.IntervalRefreshSelected);
		if ('$$scope' in $$props) $$invalidate(37, $$scope = $$props.$$scope);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty[1] & /*SelectedRows*/ 32) {
			//let BuildCelltypes = new BuildCellTypes(BaseCellTypes);
			//BuildCelltypes.join(CellTypes);
			//let CustomCellTypes = BuildCelltypes.types();
			//console.log('CellTypes:', CustomCellTypes);
			(OnSelection());
		}
	};

	return [
		SelectionType,
		IntervalRefreshSelected,
		columns,
		ShowNewButton,
		ShowEditButton,
		DataTable,
		text_search,
		loading,
		showEdit,
		ShowDialogColumn,
		PageSelected,
		RowsPerPage,
		totalFilteredRows,
		TotalPages,
		paginatedData,
		internal_columns,
		Json,
		IntervalRefresh,
		RowIsSelected,
		ChangeIntervalRefresh,
		HClickCell,
		HClickEditRow,
		HClickNew,
		HClickHeader,
		handleClickSearch,
		handleChangeSelectAll,
		handleExportSelection,
		FilterData,
		SelectPage,
		HandleOnClickEdit,
		HandleOnRowSelected,
		$$slots,
		RawDataTable,
		url,
		params,
		GetSelectedRows,
		SelectedRows,
		$$scope,
		slots,
		change_handler,
		change_handler_1,
		change_handler_2,
		input3_input_handler,
		click_handler,
		click_handler_1,
		click_handler_2,
		click_handler_3,
		click_handler_4,
		click_handler_5,
		click_handler_6,
		click_handler_7,
		click_handler_8,
		select_change_handler,
		change_handler_3,
		click_handler_9,
		click_handler_10
	];
}

class Table extends SvelteComponent {
	constructor(options) {
		super();

		init(
			this,
			options,
			instance,
			create_fragment,
			safe_not_equal,
			{
				RawDataTable: 32,
				SelectionType: 0,
				columns: 2,
				url: 33,
				params: 34,
				ShowNewButton: 3,
				ShowEditButton: 4,
				IntervalRefreshSelected: 1,
				GetSelectedRows: 35
			},
			add_css,
			[-1, -1, -1]
		);
	}

	get GetSelectedRows() {
		return this.$$.ctx[35];
	}
}

const types = require("./src/Table/Column/DefaultTypes.js");

export { types as ColumnTypes, Table };
