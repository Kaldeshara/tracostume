<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		Mesh,
		MeshStandardMaterial,
		LineSegments,
		Group,
		Plane,
		Vector3,
		Vector2,
		PerspectiveCamera,
		Raycaster,
		Scene,
		WebGLRenderer
	} from 'three';
	import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import type { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
	import { m } from '#lib/paraglide/messages.js';

	// 3D view of the container. Units are centimetres. Positions are the box's back-left-bottom
	// corner measured from the container's back-left floor corner (the door is at the front):
	// posX runs along the width, posY along the depth, posZ is the height from the floor.
	// Three.js axes: x = posX, y = posZ (up), z = posY.

	export type MapBox = {
		id: string;
		code: string;
		label: string;
		shelf: string | null;
		posXCm: number;
		posYCm: number;
		posZCm: number;
		widthCm: number;
		depthCm: number;
		heightCm: number;
	};

	type Props = {
		container: { widthCm: number; depthCm: number; heightCm: number };
		boxes: MapBox[];
		/** Box id → number of selected items it contains; those boxes are highlighted. */
		highlighted?: Record<string, number>;
		selectedId?: string | null;
		/** Whether boxes can be dragged around. */
		editable?: boolean;
		/** Called when a drag ends, with the box's new corner position. */
		onmove?: (id: string, pos: { posXCm: number; posYCm: number }) => void;
	};

	let {
		container,
		boxes,
		highlighted = {},
		selectedId = $bindable(null),
		editable = false,
		onmove
	}: Props = $props();

	const SNAP_CM = 5;
	const CLICK_TOLERANCE_PX = 6;
	const COLOR_BOX = 0xdcc6a5;
	const COLOR_HIGHLIGHT = 0xb0447f;
	const COLOR_EDGE = 0x6b5a45;
	const COLOR_BRAND = 0x7c2d5b;

	type Entry = {
		mesh: Mesh;
		material: MeshStandardMaterial;
		edges: LineSegments;
		label: CSS2DObject;
		labelEl: HTMLDivElement;
		dimsKey: string;
	};

	type Ctx = {
		THREE: typeof import('three');
		scene: Scene;
		camera: PerspectiveCamera;
		renderer: WebGLRenderer;
		labelRenderer: CSS2DRenderer;
		controls: OrbitControls;
		raycaster: Raycaster;
		pointer: Vector2;
		CSS2DObject: typeof CSS2DObject;
		entries: Map<string, Entry>;
		containerGroup: Group | null;
	};

	let wrapper: HTMLDivElement;
	let ctx: Ctx | null = null;
	let ready = $state(false);
	let drag: {
		id: string;
		plane: Plane;
		offset: Vector3;
		startX: number;
		startY: number;
		moved: boolean;
	} | null = null;

	function render() {
		if (!ctx) return;
		ctx.renderer.render(ctx.scene, ctx.camera);
		ctx.labelRenderer.render(ctx.scene, ctx.camera);
	}

	function size() {
		return Math.max(container.widthCm, container.depthCm, container.heightCm);
	}

	function lookAt(position: [number, number, number]) {
		if (!ctx) return;
		const { widthCm: W, depthCm: D, heightCm: H } = container;
		ctx.camera.position.set(...position);
		ctx.controls.target.set(W / 2, H / 3, D / 2);
		ctx.controls.update();
		render();
	}

	export function view(which: '3d' | 'top' | 'front') {
		const { widthCm: W, depthCm: D, heightCm: H } = container;
		const s = size();
		if (which === 'top') lookAt([W / 2, s * 1.3, D / 2 + 1]);
		else if (which === 'front') lookAt([W / 2, H / 2, D / 2 + s * 1.1]);
		else lookAt([W / 2 + s * 0.35, H / 2 + s * 0.5, D / 2 + s * 0.85]);
	}

	function makeLabel(text: string, className: string) {
		const el = document.createElement('div');
		el.className = className;
		el.textContent = text;
		el.style.pointerEvents = 'none';
		return el;
	}

	// Container: floor, grid, edges and a door marker at the front.
	function buildContainer() {
		if (!ctx) return;
		const { THREE, scene, CSS2DObject } = ctx;
		if (ctx.containerGroup) {
			scene.remove(ctx.containerGroup);
			ctx.containerGroup.traverse((object) => {
				if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
					object.geometry.dispose();
				}
			});
		}
		const { widthCm: W, depthCm: D, heightCm: H } = container;
		const group = new THREE.Group();

		const floor = new THREE.Mesh(
			new THREE.PlaneGeometry(W, D),
			new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 1 })
		);
		floor.rotation.x = -Math.PI / 2;
		floor.position.set(W / 2, 0, D / 2);
		floor.receiveShadow = true;
		group.add(floor);

		// 50 cm grid clipped to the floor.
		const gridPoints: number[] = [];
		for (let x = 0; x <= W; x += 50) gridPoints.push(x, 0.5, 0, x, 0.5, D);
		for (let z = 0; z <= D; z += 50) gridPoints.push(0, 0.5, z, W, 0.5, z);
		const gridGeometry = new THREE.BufferGeometry();
		gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPoints, 3));
		group.add(
			new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: 0xd6d3d1 }))
		);

		const edges = new THREE.LineSegments(
			new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)),
			new THREE.LineBasicMaterial({ color: 0x78716c })
		);
		edges.position.set(W / 2, H / 2, D / 2);
		group.add(edges);

		// Back and left walls, faint, to give a sense of the inside.
		const wallMaterial = new THREE.MeshStandardMaterial({
			color: 0xf5f5f4,
			side: THREE.DoubleSide,
			transparent: true,
			opacity: 0.6
		});
		const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMaterial);
		back.position.set(W / 2, H / 2, 0);
		group.add(back);
		const left = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMaterial);
		left.rotation.y = Math.PI / 2;
		left.position.set(0, H / 2, D / 2);
		group.add(left);

		const door = new THREE.Mesh(
			new THREE.PlaneGeometry(W, 4),
			new THREE.MeshBasicMaterial({ color: COLOR_BRAND })
		);
		door.rotation.x = -Math.PI / 2;
		door.position.set(W / 2, 1, D - 2);
		group.add(door);

		const doorLabel = new CSS2DObject(
			makeLabel(m.map_door(), 'text-[11px] font-semibold uppercase tracking-wide text-brand-700')
		);
		doorLabel.position.set(W / 2, 0, D + 12);
		group.add(doorLabel);
		const backLabel = new CSS2DObject(
			makeLabel(m.map_back(), 'text-[11px] font-semibold uppercase tracking-wide text-stone-500')
		);
		backLabel.position.set(W / 2, H + 10, 0);
		group.add(backLabel);

		scene.add(group);
		ctx.containerGroup = group;
	}

	function createEntry(box: MapBox): Entry {
		const { THREE, CSS2DObject } = ctx!;
		const material = new THREE.MeshStandardMaterial({ color: COLOR_BOX, roughness: 0.8 });
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
		mesh.userData.id = box.id;
		const edges = new THREE.LineSegments(
			new THREE.EdgesGeometry(mesh.geometry),
			new THREE.LineBasicMaterial({ color: COLOR_EDGE })
		);
		mesh.add(edges);
		const labelEl = makeLabel(
			'',
			'rounded bg-white/90 px-1.5 py-0.5 text-[11px] leading-tight whitespace-nowrap shadow'
		);
		const label = new CSS2DObject(labelEl);
		mesh.add(label);
		return { mesh, material, edges, label, labelEl, dimsKey: '' };
	}

	function disposeEntry(entry: Entry) {
		ctx!.scene.remove(entry.mesh);
		entry.mesh.geometry.dispose();
		entry.edges.geometry.dispose();
		entry.material.dispose();
		entry.labelEl.remove();
	}

	// Mirrors the boxes into the scene; runs whenever the props change.
	function sync() {
		if (!ctx) return;
		const { THREE, scene, entries } = ctx;
		const seen = new Set<string>();

		for (const box of boxes) {
			seen.add(box.id);
			let entry = entries.get(box.id);
			if (!entry) {
				entry = createEntry(box);
				entries.set(box.id, entry);
				scene.add(entry.mesh);
			}
			const { widthCm: w, depthCm: d, heightCm: h } = box;
			const dimsKey = `${w}x${d}x${h}`;
			if (entry.dimsKey !== dimsKey) {
				entry.mesh.geometry.dispose();
				entry.edges.geometry.dispose();
				entry.mesh.geometry = new THREE.BoxGeometry(w, h, d);
				entry.edges.geometry = new THREE.EdgesGeometry(entry.mesh.geometry);
				entry.label.position.set(0, h / 2 + 8, 0);
				entry.dimsKey = dimsKey;
			}
			if (drag?.id !== box.id) {
				entry.mesh.position.set(box.posXCm + w / 2, box.posZCm + h / 2, box.posYCm + d / 2);
			}

			const count = highlighted[box.id] ?? 0;
			const selected = box.id === selectedId;
			entry.material.color.setHex(count ? COLOR_HIGHLIGHT : COLOR_BOX);
			entry.material.emissive.setHex(selected ? 0xffffff : 0x000000);
			entry.material.emissiveIntensity = selected ? 0.25 : 0;
			entry.material.opacity = drag?.id === box.id ? 0.75 : 1;
			entry.material.transparent = drag?.id === box.id;
			(entry.edges.material as import('three').LineBasicMaterial).color.setHex(
				selected ? COLOR_BRAND : COLOR_EDGE
			);

			entry.labelEl.className = `rounded px-1.5 py-0.5 text-[11px] leading-tight whitespace-nowrap shadow ${
				count ? 'bg-brand-700 text-white' : selected ? 'bg-stone-900 text-white' : 'bg-white/90'
			}`;
			// Full label only where it matters, so a crowded container stays readable.
			entry.labelEl.textContent =
				count || selected ? `${box.code} · ${box.label}${count ? ` (${count})` : ''}` : box.code;
		}

		for (const [id, entry] of entries) {
			if (!seen.has(id)) {
				disposeEntry(entry);
				entries.delete(id);
			}
		}
		render();
	}

	function pick(event: PointerEvent) {
		if (!ctx) return null;
		const rect = wrapper.getBoundingClientRect();
		ctx.pointer.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1
		);
		ctx.raycaster.setFromCamera(ctx.pointer, ctx.camera);
		const meshes = [...ctx.entries.values()].map((entry) => entry.mesh);
		const hit = ctx.raycaster.intersectObjects(meshes, false)[0];
		return hit ? { id: hit.object.userData.id as string, point: hit.point } : null;
	}

	function onpointerdown(event: PointerEvent) {
		if (!ctx || (event.pointerType === 'mouse' && event.button !== 0)) return;
		const hit = pick(event);
		const box = hit && boxes.find((other) => other.id === hit.id);
		if (!hit || !box || !editable) {
			// A plain click on empty space (handled on pointerup) deselects.
			drag = null;
			pendingClick = { hitId: hit?.id ?? null, startX: event.clientX, startY: event.clientY };
			return;
		}
		const entry = ctx.entries.get(box.id)!;
		// Drag on the horizontal plane through the box's centre, so the box keeps its height.
		const plane = new ctx.THREE.Plane(new ctx.THREE.Vector3(0, 1, 0), -entry.mesh.position.y);
		drag = {
			id: box.id,
			plane,
			offset: hit.point.clone().sub(entry.mesh.position),
			startX: event.clientX,
			startY: event.clientY,
			moved: false
		};
		ctx.controls.enabled = false;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	let pendingClick: { hitId: string | null; startX: number; startY: number } | null = null;

	function onpointermove(event: PointerEvent) {
		if (!ctx || !drag) return;
		const box = boxes.find((other) => other.id === drag!.id);
		const entry = ctx.entries.get(drag.id);
		if (!box || !entry) return;
		if (
			Math.abs(event.clientX - drag.startX) > CLICK_TOLERANCE_PX ||
			Math.abs(event.clientY - drag.startY) > CLICK_TOLERANCE_PX
		) {
			drag.moved = true;
		}
		if (!drag.moved) return;

		const rect = wrapper.getBoundingClientRect();
		ctx.pointer.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1
		);
		ctx.raycaster.setFromCamera(ctx.pointer, ctx.camera);
		const point = new ctx.THREE.Vector3();
		if (!ctx.raycaster.ray.intersectPlane(drag.plane, point)) return;

		const { widthCm: w, depthCm: d } = box;
		const snap = (value: number, max: number) =>
			Math.min(Math.max(Math.round(value / SNAP_CM) * SNAP_CM, 0), Math.max(0, max));
		const cornerX = snap(point.x - drag.offset.x - w / 2, container.widthCm - w);
		const cornerY = snap(point.z - drag.offset.z - d / 2, container.depthCm - d);
		entry.mesh.position.x = cornerX + w / 2;
		entry.mesh.position.z = cornerY + d / 2;
		entry.material.transparent = true;
		entry.material.opacity = 0.75;
		render();
	}

	function onpointerup(event: PointerEvent) {
		if (!ctx) return;
		if (drag) {
			const current = drag;
			drag = null;
			ctx.controls.enabled = true;
			(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
			const entry = ctx.entries.get(current.id);
			const box = boxes.find((other) => other.id === current.id);
			if (current.moved && entry && box) {
				onmove?.(current.id, {
					posXCm: Math.round(entry.mesh.position.x - box.widthCm / 2),
					posYCm: Math.round(entry.mesh.position.z - box.depthCm / 2)
				});
			} else {
				selectedId = current.id;
			}
			sync();
			return;
		}
		if (pendingClick) {
			const { hitId, startX, startY } = pendingClick;
			pendingClick = null;
			if (
				Math.abs(event.clientX - startX) <= CLICK_TOLERANCE_PX &&
				Math.abs(event.clientY - startY) <= CLICK_TOLERANCE_PX
			) {
				selectedId = hitId;
			}
		}
	}

	onMount(() => {
		let disposed = false;
		let observer: ResizeObserver | undefined;

		(async () => {
			const [THREE, { OrbitControls }, { CSS2DRenderer, CSS2DObject }] = await Promise.all([
				import('three'),
				import('three/addons/controls/OrbitControls.js'),
				import('three/addons/renderers/CSS2DRenderer.js')
			]);
			if (disposed) return;

			const scene = new THREE.Scene();
			scene.background = new THREE.Color(0xfafaf9);
			scene.add(new THREE.HemisphereLight(0xffffff, 0xa8a29e, 1.4));
			const sun = new THREE.DirectionalLight(0xffffff, 1.2);
			sun.position.set(size(), size() * 2, size() * 1.5);
			scene.add(sun);

			const camera = new THREE.PerspectiveCamera(45, 1, 1, size() * 20);
			const renderer = new THREE.WebGLRenderer({ antialias: true });
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
			// The wrapper is an empty div that Three.js owns; Svelte never renders into it.
			// eslint-disable-next-line svelte/no-dom-manipulating
			wrapper.appendChild(renderer.domElement);

			const labelRenderer = new CSS2DRenderer();
			Object.assign(labelRenderer.domElement.style, {
				position: 'absolute',
				inset: '0',
				pointerEvents: 'none'
			});
			// eslint-disable-next-line svelte/no-dom-manipulating
			wrapper.appendChild(labelRenderer.domElement);

			const controls = new OrbitControls(camera, renderer.domElement);
			controls.maxPolarAngle = Math.PI / 2 - 0.02;
			controls.addEventListener('change', render);

			ctx = {
				THREE,
				scene,
				camera,
				renderer,
				labelRenderer,
				controls,
				raycaster: new THREE.Raycaster(),
				pointer: new THREE.Vector2(),
				CSS2DObject,
				entries: new Map(),
				containerGroup: null
			};

			const resize = () => {
				const { clientWidth: w, clientHeight: h } = wrapper;
				camera.aspect = w / h;
				camera.updateProjectionMatrix();
				renderer.setSize(w, h);
				labelRenderer.setSize(w, h);
				render();
			};
			observer = new ResizeObserver(resize);
			observer.observe(wrapper);
			resize();
			view('3d');
			ready = true;
		})();

		return () => {
			disposed = true;
			observer?.disconnect();
			if (ctx) {
				ctx.controls.dispose();
				ctx.entries.forEach(disposeEntry);
				ctx.renderer.dispose();
				ctx.renderer.domElement.remove();
				ctx.labelRenderer.domElement.remove();
				ctx = null;
			}
		};
	});

	$effect(() => {
		if (!ready) return;
		// Read the dimensions so this effect re-runs when they change.
		void [container.widthCm, container.depthCm, container.heightCm];
		buildContainer();
		view('3d');
	});

	$effect(() => {
		if (!ready) return;
		// Deep read of the props so any change (position, size, highlight, selection) re-syncs.
		void JSON.stringify(boxes);
		void JSON.stringify(highlighted);
		void selectedId;
		sync();
	});
</script>

<div class="relative h-full w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={wrapper}
		class="h-full w-full touch-none"
		{onpointerdown}
		{onpointermove}
		{onpointerup}
		onpointercancel={onpointerup}
	></div>
	<div class="absolute top-2 left-2 flex gap-1">
		<button type="button" class="btn px-2 py-1 text-xs" onclick={() => view('3d')}>
			{m.map_view_3d()}
		</button>
		<button type="button" class="btn px-2 py-1 text-xs" onclick={() => view('top')}>
			{m.map_view_top()}
		</button>
		<button type="button" class="btn px-2 py-1 text-xs" onclick={() => view('front')}>
			{m.map_view_front()}
		</button>
	</div>
	{#if !ready}
		<div class="absolute inset-0 flex items-center justify-center text-sm text-stone-500">…</div>
	{/if}
</div>
