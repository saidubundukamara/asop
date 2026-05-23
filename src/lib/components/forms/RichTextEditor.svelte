<script lang="ts">
	import { onMount } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';
	import Placeholder from '@tiptap/extension-placeholder';
	import BoldIcon from '@lucide/svelte/icons/bold';
	import ItalicIcon from '@lucide/svelte/icons/italic';
	import ListIcon from '@lucide/svelte/icons/list';
	import ListOrderedIcon from '@lucide/svelte/icons/list-ordered';
	import LinkIcon from '@lucide/svelte/icons/link';

	// Reusable rich-text editor. Uses tiptap's framework-agnostic Editor class
	// because the official @tiptap/svelte adapter doesn't yet target Svelte 5
	// runes. The editor mounts on an empty <div> in onMount and is destroyed in
	// the cleanup callback.
	//
	// All HTML output is sanitized server-side via sanitizeRichText() before
	// persistence — the editor is not a security boundary.
	//
	// Lazy-imported by CreateTaskSheet / EditTaskSheet so list pages don't pull
	// the ~50KB tiptap bundle (PRD § 9.2 initial-JS budget).

	type Props = {
		value: string;
		onChange: (html: string) => void;
		placeholder?: string;
		ariaLabel: string;
	};

	let { value, onChange, placeholder = 'Write here…', ariaLabel }: Props = $props();

	let host: HTMLDivElement;
	let editor: Editor | null = $state(null);
	// Reactive snapshot of marks/lists for toolbar active states.
	let active = $state({ bold: false, italic: false, bullet: false, ordered: false, link: false });

	function syncActive(ed: Editor) {
		active = {
			bold: ed.isActive('bold'),
			italic: ed.isActive('italic'),
			bullet: ed.isActive('bulletList'),
			ordered: ed.isActive('orderedList'),
			link: ed.isActive('link')
		};
	}

	onMount(() => {
		const ed = new Editor({
			element: host,
			content: value || '',
			extensions: [
				StarterKit.configure({
					// We render h2/h3 (sanitizer allows them) — disable h1 to keep
					// document structure under the page's h1.
					heading: { levels: [2, 3] }
				}),
				Link.configure({
					openOnClick: false,
					autolink: true,
					HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' }
				}),
				Placeholder.configure({ placeholder })
			],
			editorProps: {
				attributes: {
					'aria-label': ariaLabel,
					class:
						'prose prose-sm max-w-none min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
				}
			},
			onUpdate: ({ editor }) => {
				onChange(editor.getHTML());
				syncActive(editor);
			},
			onSelectionUpdate: ({ editor }) => syncActive(editor),
			onTransaction: ({ editor }) => syncActive(editor)
		});
		editor = ed;
		return () => {
			ed.destroy();
		};
	});

	function toggleBold() {
		editor?.chain().focus().toggleBold().run();
	}
	function toggleItalic() {
		editor?.chain().focus().toggleItalic().run();
	}
	function toggleBullet() {
		editor?.chain().focus().toggleBulletList().run();
	}
	function toggleOrdered() {
		editor?.chain().focus().toggleOrderedList().run();
	}
	function toggleLink() {
		if (!editor) return;
		if (editor.isActive('link')) {
			editor.chain().focus().unsetLink().run();
			return;
		}
		const url = window.prompt('Link URL');
		if (!url) return;
		editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
	}

	function btnClass(on: boolean) {
		return [
			'inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs transition',
			on
				? 'border-foreground/30 bg-accent text-accent-foreground'
				: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
		].join(' ');
	}
</script>

<div class="grid gap-1.5">
	<div class="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Formatting">
		<button
			type="button"
			class={btnClass(active.bold)}
			onclick={toggleBold}
			aria-label="Bold"
			aria-pressed={active.bold}
		>
			<BoldIcon class="size-3.5" />
		</button>
		<button
			type="button"
			class={btnClass(active.italic)}
			onclick={toggleItalic}
			aria-label="Italic"
			aria-pressed={active.italic}
		>
			<ItalicIcon class="size-3.5" />
		</button>
		<button
			type="button"
			class={btnClass(active.bullet)}
			onclick={toggleBullet}
			aria-label="Bulleted list"
			aria-pressed={active.bullet}
		>
			<ListIcon class="size-3.5" />
		</button>
		<button
			type="button"
			class={btnClass(active.ordered)}
			onclick={toggleOrdered}
			aria-label="Numbered list"
			aria-pressed={active.ordered}
		>
			<ListOrderedIcon class="size-3.5" />
		</button>
		<button
			type="button"
			class={btnClass(active.link)}
			onclick={toggleLink}
			aria-label={active.link ? 'Remove link' : 'Insert link'}
			aria-pressed={active.link}
		>
			<LinkIcon class="size-3.5" />
		</button>
	</div>
	<div bind:this={host}></div>
</div>
