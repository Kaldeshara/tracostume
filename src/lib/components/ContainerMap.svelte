<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		Group,
		Mesh,
		MeshStandardMaterial,
		Object3D,
		PerspectiveCamera,
		Plane,
		Raycaster,
		Scene,
		Texture,
		Vector2,
		Vector3,
		WebGLRenderer
	} from 'three';
	import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import type { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
	import type { BoxKind, DoorSide } from '../../generated/prisma/enums';
	import { m } from '#lib/paraglide/messages.js';
	import { KIND_ICONS } from '#lib/format.ts';

	// 3D view of the container. Units are centimetres. Positions are a unit's back-left-bottom
	// corner measured from the container's back-left floor corner. posX runs along the width,
	// posY along the depth (FRONT = y max), posZ is the height from the floor.
	// Three.js axes: x = posX, y = posZ (up), z = posY.

	export type MapBox = {
		id: string;
		code: string;
		label: string;
		shelf: string | null;
		kind: BoxKind;
		posXCm: number;
		posYCm: number;
		posZCm: number;
		widthCm: number;
		depthCm: number;
		heightCm: number;
	};

	type Props = {
		container: { widthCm: number; depthCm: number; heightCm: number; doorSide: DoorSide };
		boxes: MapBox[];
		/** Unit id → number of selected items it contains; those units are highlighted. */
		highlighted?: Record<string, number>;
		selectedId?: string | null;
		/** Whether units can be dragged around. */
		editable?: boolean;
		/** Called when a drag ends, with the unit's new corner position. */
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
	const BRAND = 0x7c2d5b;
	const AMBER = 0xf59e0b;

	type Entry = {
		root: Group;
		materials: MeshStandardMaterial[];
		glow: Mesh;
		label: CSS2DObject;
		labelEl: HTMLDivElement;
		key: string;
	};

	type Ctx = {
		THREE: typeof import('three');
		RoundedBoxGeometry: typeof import('three/addons/geometries/RoundedBoxGeometry.js').RoundedBoxGeometry;
		CSS2DObject: typeof CSS2DObject;
		scene: Scene;
		camera: PerspectiveCamera;
		renderer: WebGLRenderer;
		labelRenderer: CSS2DRenderer;
		controls: OrbitControls;
		raycaster: Raycaster;
		pointer: Vector2;
		entries: Map<string, Entry>;
		containerGroup: Group | null;
		textures: Texture[];
	};

	let wrapper: HTMLDivElement;
	let ctx: Ctx | null = null;
	let ready = $state(false);
	let needsRender = true;
	let hoveredId: string | null = null;
	let drag: {
		id: string;
		plane: Plane;
		offset: Vector3;
		startX: number;
		startY: number;
		moved: boolean;
	} | null = null;
	let pendingClick: { hitId: string | null; startX: number; startY: number } | null = null;

	const invalidate = () => (needsRender = true);

	function render() {
		if (!ctx) return;
		ctx.renderer.render(ctx.scene, ctx.camera);
		ctx.labelRenderer.render(ctx.scene, ctx.camera);
	}

	const size = () => Math.max(container.widthCm, container.depthCm, container.heightCm);

	/** Unit vector pointing from the container centre towards the door wall. */
	function doorDirection() {
		return { FRONT: [0, 1], BACK: [0, -1], LEFT: [-1, 0], RIGHT: [1, 0] }[container.doorSide] as [
			number,
			number
		];
	}

	function lookAt(position: [number, number, number]) {
		if (!ctx) return;
		const { widthCm: W, depthCm: D, heightCm: H } = container;
		ctx.camera.position.set(...position);
		ctx.controls.target.set(W / 2, H / 3, D / 2);
		ctx.controls.update();
		invalidate();
	}

	export function view(which: '3d' | 'top' | 'front') {
		const { widthCm: W, depthCm: D, heightCm: H } = container;
		const s = size();
		const [dx, dz] = doorDirection();
		if (which === 'top') lookAt([W / 2, s * 1.3, D / 2 + 1]);
		else if (which === 'front') lookAt([W / 2 + dx * s * 1.1, H / 2, D / 2 + dz * s * 1.1]);
		else
			lookAt([
				W / 2 + dx * s * 0.85 + dz * s * 0.35,
				H / 2 + s * 0.5,
				D / 2 + dz * s * 0.85 - dx * s * 0.35
			]);
	}

	function makeLabel(className: string, text = '') {
		const el = document.createElement('div');
		el.className = className;
		el.textContent = text;
		el.style.pointerEvents = 'none';
		return el;
	}

	// --- Procedural textures (no image files to load) ---------------------------------------

	function canvasTexture(
		width: number,
		height: number,
		draw: (c: CanvasRenderingContext2D) => void
	) {
		const { THREE } = ctx!;
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		draw(canvas.getContext('2d')!);
		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
		texture.anisotropy = 4;
		ctx!.textures.push(texture);
		return texture;
	}

	/** Corrugated steel: vertical ridges, lit from the left. One tile = one ridge. */
	function corrugated(ridges: number) {
		const texture = canvasTexture(64, 64, (c) => {
			const g = c.createLinearGradient(0, 0, 64, 0);
			g.addColorStop(0, '#9db5cc');
			g.addColorStop(0.35, '#b4c8da');
			g.addColorStop(0.5, '#8ba5bf');
			g.addColorStop(0.8, '#7f9bb6');
			g.addColorStop(1, '#9db5cc');
			c.fillStyle = g;
			c.fillRect(0, 0, 64, 64);
		});
		texture.repeat.set(ridges, 1);
		return texture;
	}

	/** The door wall: corrugated background with two door leaves and their locking bars. */
	function doorTexture(ridges: number) {
		return canvasTexture(1024, 512, (c) => {
			const g = c.createLinearGradient(0, 0, 1024 / ridges, 0);
			g.addColorStop(0, '#9db5cc');
			g.addColorStop(0.5, '#8ba5bf');
			g.addColorStop(1, '#9db5cc');
			c.fillStyle = g;
			for (let x = 0; x < 1024; x += 1024 / ridges) {
				c.save();
				c.translate(x, 0);
				c.fillRect(0, 0, 1024 / ridges + 1, 512);
				c.restore();
			}
			// Door leaves: flat panels, slightly darker, split in the middle.
			c.fillStyle = '#7390ab';
			c.fillRect(40, 20, 944, 492);
			c.fillStyle = '#86a3bd';
			c.fillRect(48, 28, 460, 484);
			c.fillRect(516, 28, 460, 484);
			// Locking bars and handles.
			c.fillStyle = '#c9d3dc';
			for (const x of [140, 240, 700, 800]) c.fillRect(x, 24, 10, 488);
			c.fillStyle = '#e6ebf0';
			for (const x of [128, 228, 688, 788]) c.fillRect(x, 230, 34, 16);
			c.fillStyle = '#2f4458';
			c.fillRect(508, 20, 8, 492);
		});
	}

	/** Plywood floor: planks with a faint grain. */
	function plywood(repeatX: number, repeatY: number) {
		const texture = canvasTexture(256, 256, (c) => {
			c.fillStyle = '#b89265';
			c.fillRect(0, 0, 256, 256);
			for (let i = 0; i < 60; i++) {
				c.strokeStyle = `rgba(90, 60, 30, ${0.05 + Math.random() * 0.08})`;
				c.lineWidth = 1 + Math.random() * 2;
				const y = Math.random() * 256;
				c.beginPath();
				c.moveTo(0, y);
				c.bezierCurveTo(80, y + Math.random() * 6 - 3, 170, y + Math.random() * 6 - 3, 256, y);
				c.stroke();
			}
			c.strokeStyle = 'rgba(60, 40, 20, 0.45)';
			c.lineWidth = 3;
			for (const y of [0, 128]) {
				c.beginPath();
				c.moveTo(0, y);
				c.lineTo(256, y);
				c.stroke();
			}
		});
		texture.repeat.set(repeatX, repeatY);
		return texture;
	}

	// --- Container ----------------------------------------------------------------------------

	function disposeGroup(group: Object3D) {
		group.traverse((object) => {
			const mesh = object as Mesh;
			if (mesh.geometry) mesh.geometry.dispose();
			const material = mesh.material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;
			if (Array.isArray(material)) material.forEach((mat) => mat.dispose());
			else material?.dispose();
		});
	}

	function buildContainer() {
		if (!ctx) return;
		const { THREE, scene, CSS2DObject } = ctx;
		if (ctx.containerGroup) {
			scene.remove(ctx.containerGroup);
			disposeGroup(ctx.containerGroup);
			ctx.textures.forEach((texture) => texture.dispose());
			ctx.textures = [];
		}
		const { widthCm: W, depthCm: D, heightCm: H } = container;
		const group = new THREE.Group();
		const RIDGE_CM = 23;

		// The shell is drawn from the inside (BackSide): whatever the angle, only the far walls
		// show, so the inside is always visible.
		const wall = (ridges: number) =>
			new THREE.MeshStandardMaterial({
				map: corrugated(ridges),
				roughness: 0.6,
				metalness: 0.35,
				side: THREE.BackSide
			});
		const door = (ridges: number) =>
			new THREE.MeshStandardMaterial({
				map: doorTexture(ridges),
				roughness: 0.55,
				metalness: 0.35,
				side: THREE.BackSide
			});
		const roof = new THREE.MeshStandardMaterial({
			color: 0xc3d0dc,
			roughness: 0.8,
			metalness: 0.2,
			side: THREE.BackSide
		});
		const floorMaterial = new THREE.MeshStandardMaterial({
			map: plywood(W / 120, D / 120),
			roughness: 0.9,
			side: THREE.BackSide
		});
		// Face order of BoxGeometry: +x, -x, +y, -y, +z, -z.
		const faces = [
			container.doorSide === 'RIGHT' ? door(D / RIDGE_CM) : wall(D / RIDGE_CM),
			container.doorSide === 'LEFT' ? door(D / RIDGE_CM) : wall(D / RIDGE_CM),
			roof,
			floorMaterial,
			container.doorSide === 'FRONT' ? door(W / RIDGE_CM) : wall(W / RIDGE_CM),
			container.doorSide === 'BACK' ? door(W / RIDGE_CM) : wall(W / RIDGE_CM)
		];
		const shell = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), faces);
		shell.position.set(W / 2, H / 2, D / 2);
		shell.receiveShadow = true;
		group.add(shell);

		// Edge frame of the container.
		const edges = new THREE.LineSegments(
			new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)),
			new THREE.LineBasicMaterial({ color: 0x2f4458, transparent: true, opacity: 0.6 })
		);
		edges.position.set(W / 2, H / 2, D / 2);
		group.add(edges);

		// 50 cm grid, faint, to read positions.
		const gridPoints: number[] = [];
		for (let x = 0; x <= W; x += 50) gridPoints.push(x, 0.3, 0, x, 0.3, D);
		for (let z = 0; z <= D; z += 50) gridPoints.push(0, 0.3, z, W, 0.3, z);
		const gridGeometry = new THREE.BufferGeometry();
		gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPoints, 3));
		group.add(
			new THREE.LineSegments(
				gridGeometry,
				new THREE.LineBasicMaterial({ color: 0x3b2a1a, transparent: true, opacity: 0.18 })
			)
		);

		// Door label just outside the door wall, at floor level.
		const [dx, dz] = doorDirection();
		const doorLabel = new CSS2DObject(
			makeLabel(
				'rounded-full bg-brand-700 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white uppercase shadow',
				m.map_door()
			)
		);
		doorLabel.position.set(W / 2 + dx * (W / 2 + 14), 2, D / 2 + dz * (D / 2 + 14));
		group.add(doorLabel);

		scene.add(group);
		ctx.containerGroup = group;
		invalidate();
	}

	// --- Storage units ------------------------------------------------------------------------

	const PALETTE = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1];

	/** Builds the meshes of one unit, centred on the origin. */
	function buildKind(
		kind: BoxKind,
		w: number,
		h: number,
		d: number,
		materials: MeshStandardMaterial[]
	) {
		const { THREE, RoundedBoxGeometry } = ctx!;
		const group = new THREE.Group();
		const mesh = (
			geometry: Mesh['geometry'],
			material: MeshStandardMaterial,
			x = 0,
			y = 0,
			z = 0
		) => {
			const object = new THREE.Mesh(geometry, material);
			object.position.set(x, y, z);
			object.castShadow = true;
			object.receiveShadow = true;
			group.add(object);
			materials.push(material);
			return object;
		};
		const standard = (color: number, extra: Partial<MeshStandardMaterial> = {}) =>
			Object.assign(new THREE.MeshStandardMaterial({ color, roughness: 0.85 }), extra);

		switch (kind) {
			case 'PLASTIC_BOX': {
				mesh(
					new THREE.BoxGeometry(w, h - 4, d),
					standard(0xcfe2f3, { transparent: true, opacity: 0.6, roughness: 0.25 }),
					0,
					-2,
					0
				);
				mesh(
					new THREE.BoxGeometry(w + 2, 4, d + 2),
					standard(0x3b6fa8, { roughness: 0.5 }),
					0,
					h / 2 - 2,
					0
				);
				break;
			}
			case 'CARDBOARD_BOX': {
				mesh(new THREE.BoxGeometry(w, h, d), standard(0xc39a66, { roughness: 0.95 }));
				// Tape across the lid.
				mesh(
					new THREE.BoxGeometry(Math.min(8, w / 4), 0.6, d + 0.4),
					standard(0xe3d3ad),
					0,
					h / 2,
					0
				);
				const edges = new THREE.LineSegments(
					new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
					new THREE.LineBasicMaterial({ color: 0x8a6a40, transparent: true, opacity: 0.7 })
				);
				group.add(edges);
				break;
			}
			case 'CANVAS_BAG': {
				mesh(
					new RoundedBoxGeometry(w, h, d, 4, Math.min(8, h / 4)),
					standard(0x9aa37a, { roughness: 1 })
				);
				const handle = new THREE.TorusGeometry(w * 0.16, 1.4, 8, 24, Math.PI);
				for (const z of [-d * 0.2, d * 0.2]) {
					const ring = mesh(handle, standard(0x6b7355), 0, h / 2 - 1, z);
					ring.castShadow = false;
				}
				break;
			}
			case 'RACK': {
				// A clothes rail: base frame on casters, two uprights, a top bar, hung clothes.
				const metal = () => standard(0xe6e9ec, { metalness: 0.7, roughness: 0.3 });
				const r = 1.6;
				const alongX = (length: number, y: number, z: number) => {
					const bar = mesh(new THREE.CylinderGeometry(r, r, length, 10), metal(), 0, y, z);
					bar.rotation.z = Math.PI / 2;
					return bar;
				};
				const alongZ = (length: number, x: number, y: number) => {
					const bar = mesh(new THREE.CylinderGeometry(r, r, length, 10), metal(), x, y, 0);
					bar.rotation.x = Math.PI / 2;
					return bar;
				};
				const baseY = -h / 2 + 6;
				alongX(w, baseY, -d / 2 + 4);
				alongX(w, baseY, d / 2 - 4);
				alongZ(d - 8, -w / 2 + 2, baseY);
				alongZ(d - 8, w / 2 - 2, baseY);
				for (const x of [-w / 2 + 4, w / 2 - 4]) {
					for (const z of [-d / 2 + 4, d / 2 - 4]) {
						const caster = mesh(
							new THREE.CylinderGeometry(4, 4, 3, 12),
							standard(0x333333),
							x,
							-h / 2 + 4,
							z
						);
						caster.rotation.x = Math.PI / 2;
					}
				}
				for (const x of [-w / 2 + 6, w / 2 - 6]) {
					mesh(new THREE.CylinderGeometry(r, r, h - 10, 10), metal(), x, 1, 0);
				}
				alongX(w, h / 2 - 2, 0);
				// Hung clothes, as a row of soft slabs.
				const count = Math.max(3, Math.floor(w / 18));
				const slabW = (w - 16) / count - 2;
				for (let i = 0; i < count; i++) {
					const x = -w / 2 + 8 + slabW / 2 + i * (slabW + 2);
					const slabH = h * (0.45 + ((i * 7) % 3) * 0.06);
					const slab = mesh(
						new RoundedBoxGeometry(slabW, slabH, d * 0.55, 3, 3),
						standard(PALETTE[i % PALETTE.length], { roughness: 1 }),
						x,
						h / 2 - 4 - slabH / 2,
						0
					);
					slab.receiveShadow = false;
				}
				break;
			}
			default: {
				mesh(new THREE.BoxGeometry(w, h, d), standard(0xdcc6a5));
				group.add(
					new THREE.LineSegments(
						new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
						new THREE.LineBasicMaterial({ color: 0x6b5a45 })
					)
				);
			}
		}
		return group;
	}

	function createEntry(box: MapBox): Entry {
		const { THREE, CSS2DObject, scene } = ctx!;
		const root = new THREE.Group();
		root.userData.id = box.id;
		const glow = new THREE.Mesh(
			new THREE.BoxGeometry(1, 1, 1),
			new THREE.MeshBasicMaterial({
				color: BRAND,
				transparent: true,
				opacity: 0.3,
				depthWrite: false
			})
		);
		glow.visible = false;
		root.add(glow);
		const labelEl = makeLabel('');
		const label = new CSS2DObject(labelEl);
		root.add(label);
		scene.add(root);
		return { root, materials: [], glow, label, labelEl, key: '' };
	}

	function disposeEntry(entry: Entry) {
		ctx!.scene.remove(entry.root);
		disposeGroup(entry.root);
		entry.labelEl.remove();
	}

	/** Mirrors the units into the scene; runs whenever the props change. */
	function sync() {
		if (!ctx) return;
		const { THREE, entries } = ctx;
		const seen = new Set<string>();

		for (const box of boxes) {
			seen.add(box.id);
			let entry = entries.get(box.id);
			if (!entry) {
				entry = createEntry(box);
				entries.set(box.id, entry);
			}
			const { widthCm: w, depthCm: d, heightCm: h } = box;
			const key = `${box.kind}:${w}x${d}x${h}`;
			if (entry.key !== key) {
				for (const child of [...entry.root.children]) {
					if (child !== entry.glow && child !== entry.label) {
						entry.root.remove(child);
						disposeGroup(child);
					}
				}
				entry.materials = [];
				entry.root.add(buildKind(box.kind, w, h, d, entry.materials));
				entry.glow.geometry.dispose();
				entry.glow.geometry = new THREE.BoxGeometry(w + 8, h + 8, d + 8);
				entry.label.position.set(0, h / 2 + 12, 0);
				entry.key = key;
			}
			if (drag?.id !== box.id) {
				entry.root.position.set(box.posXCm + w / 2, box.posZCm + h / 2, box.posYCm + d / 2);
			}

			const count = highlighted[box.id] ?? 0;
			const selected = box.id === selectedId;
			const hovered = box.id === hoveredId;
			entry.glow.visible = selected || count > 0;
			(entry.glow.material as import('three').MeshBasicMaterial).color.setHex(
				selected ? AMBER : BRAND
			);
			(entry.glow.material as import('three').MeshBasicMaterial).opacity = selected ? 0.35 : 0.28;
			for (const material of entry.materials) {
				material.emissive.setHex(hovered && editable ? 0xffffff : 0x000000);
				material.emissiveIntensity = hovered && editable ? 0.12 : 0;
				material.opacity = drag?.id === box.id ? Math.min(material.opacity, 0.7) : material.opacity;
			}

			entry.labelEl.className = `flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-tight whitespace-nowrap shadow-md ring-1 ring-black/10 ${
				count
					? 'bg-brand-700 text-white'
					: selected
						? 'bg-amber-400 text-stone-900'
						: 'bg-white/95 text-stone-800'
			}`;
			const full = count || selected;
			entry.labelEl.textContent = `${KIND_ICONS[box.kind]} ${full ? `${box.code} · ${box.label}` : box.label}${count ? ` (${count})` : ''}`;
		}

		for (const [id, entry] of entries) {
			if (!seen.has(id)) {
				disposeEntry(entry);
				entries.delete(id);
			}
		}
		invalidate();
	}

	// --- Interaction ---------------------------------------------------------------------------

	function setPointer(event: PointerEvent) {
		const rect = wrapper.getBoundingClientRect();
		ctx!.pointer.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1
		);
		ctx!.raycaster.setFromCamera(ctx!.pointer, ctx!.camera);
	}

	function pick(event: PointerEvent) {
		if (!ctx) return null;
		setPointer(event);
		const roots = [...ctx.entries.values()].map((entry) => entry.root);
		for (const hit of ctx.raycaster.intersectObjects(roots, true)) {
			let object: Object3D | null = hit.object;
			if (object === (ctx.entries.get(object.parent?.userData.id)?.glow ?? null)) continue;
			while (object && !object.userData.id) object = object.parent;
			if (object) return { id: object.userData.id as string, point: hit.point };
		}
		return null;
	}

	function onpointerdown(event: PointerEvent) {
		if (!ctx || (event.pointerType === 'mouse' && event.button !== 0)) return;
		const hit = pick(event);
		const box = hit && boxes.find((other) => other.id === hit.id);
		if (!hit || !box || !editable) {
			drag = null;
			pendingClick = { hitId: hit?.id ?? null, startX: event.clientX, startY: event.clientY };
			return;
		}
		const entry = ctx.entries.get(box.id)!;
		// Drag on the horizontal plane through the unit's centre, so it keeps its height.
		const plane = new ctx.THREE.Plane(new ctx.THREE.Vector3(0, 1, 0), -entry.root.position.y);
		drag = {
			id: box.id,
			plane,
			offset: hit.point.clone().sub(entry.root.position),
			startX: event.clientX,
			startY: event.clientY,
			moved: false
		};
		ctx.controls.enabled = false;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function onpointermove(event: PointerEvent) {
		if (!ctx) return;
		if (!drag) {
			if (event.pointerType !== 'mouse') return;
			const id = pick(event)?.id ?? null;
			if (id !== hoveredId) {
				hoveredId = id;
				wrapper.style.cursor = id && editable ? 'grab' : 'default';
				sync();
			}
			return;
		}
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

		setPointer(event);
		const point = new ctx.THREE.Vector3();
		if (!ctx.raycaster.ray.intersectPlane(drag.plane, point)) return;

		const { widthCm: w, depthCm: d } = box;
		const snap = (value: number, max: number) =>
			Math.min(Math.max(Math.round(value / SNAP_CM) * SNAP_CM, 0), Math.max(0, max));
		const cornerX = snap(point.x - drag.offset.x - w / 2, container.widthCm - w);
		const cornerY = snap(point.z - drag.offset.z - d / 2, container.depthCm - d);
		entry.root.position.x = cornerX + w / 2;
		entry.root.position.z = cornerY + d / 2;
		wrapper.style.cursor = 'grabbing';
		invalidate();
	}

	function onpointerup(event: PointerEvent) {
		if (!ctx) return;
		if (drag) {
			const current = drag;
			drag = null;
			ctx.controls.enabled = true;
			wrapper.style.cursor = 'grab';
			(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
			const entry = ctx.entries.get(current.id);
			const box = boxes.find((other) => other.id === current.id);
			if (current.moved && entry && box) {
				onmove?.(current.id, {
					posXCm: Math.round(entry.root.position.x - box.widthCm / 2),
					posYCm: Math.round(entry.root.position.z - box.depthCm / 2)
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
		let frame = 0;

		(async () => {
			const [THREE, { OrbitControls }, { CSS2DRenderer, CSS2DObject }, { RoundedBoxGeometry }] =
				await Promise.all([
					import('three'),
					import('three/addons/controls/OrbitControls.js'),
					import('three/addons/renderers/CSS2DRenderer.js'),
					import('three/addons/geometries/RoundedBoxGeometry.js')
				]);
			if (disposed) return;

			const scene = new THREE.Scene();
			scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8a78, 1.2));
			scene.add(new THREE.AmbientLight(0xffffff, 0.35));
			const sun = new THREE.DirectionalLight(0xfff3e0, 1.8);
			sun.castShadow = true;
			sun.shadow.mapSize.set(2048, 2048);
			sun.shadow.bias = -0.0004;
			scene.add(sun);
			scene.add(sun.target);

			const camera = new THREE.PerspectiveCamera(42, 1, 1, size() * 20);
			const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
			renderer.shadowMap.enabled = true;
			renderer.shadowMap.type = THREE.PCFSoftShadowMap;
			renderer.toneMapping = THREE.ACESFilmicToneMapping;
			renderer.toneMappingExposure = 1.05;
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
			controls.enableDamping = true;
			controls.dampingFactor = 0.08;
			controls.maxPolarAngle = Math.PI / 2 - 0.03;
			controls.minDistance = size() * 0.3;
			controls.maxDistance = size() * 4;
			controls.addEventListener('change', invalidate);

			ctx = {
				THREE,
				RoundedBoxGeometry,
				CSS2DObject,
				scene,
				camera,
				renderer,
				labelRenderer,
				controls,
				raycaster: new THREE.Raycaster(),
				pointer: new THREE.Vector2(),
				entries: new Map(),
				containerGroup: null,
				textures: []
			};

			const placeSun = () => {
				const s = size();
				sun.position.set(container.widthCm * 0.3, s * 2.2, container.depthCm * 1.6);
				sun.target.position.set(container.widthCm / 2, 0, container.depthCm / 2);
				const cam = sun.shadow.camera;
				cam.left = -s;
				cam.right = s;
				cam.top = s;
				cam.bottom = -s;
				cam.near = 1;
				cam.far = s * 6;
				cam.updateProjectionMatrix();
			};
			placeSun();

			const resize = () => {
				const { clientWidth: w, clientHeight: h } = wrapper;
				camera.aspect = w / h;
				camera.updateProjectionMatrix();
				renderer.setSize(w, h);
				labelRenderer.setSize(w, h);
				invalidate();
			};
			observer = new ResizeObserver(resize);
			observer.observe(wrapper);
			resize();
			view('3d');
			ready = true;

			const loop = () => {
				if (disposed) return;
				if (controls.update() || needsRender) {
					needsRender = false;
					render();
				}
				frame = requestAnimationFrame(loop);
			};
			loop();
		})();

		return () => {
			disposed = true;
			cancelAnimationFrame(frame);
			observer?.disconnect();
			if (ctx) {
				ctx.controls.dispose();
				ctx.entries.forEach(disposeEntry);
				if (ctx.containerGroup) disposeGroup(ctx.containerGroup);
				ctx.textures.forEach((texture) => texture.dispose());
				ctx.renderer.dispose();
				ctx.renderer.domElement.remove();
				ctx.labelRenderer.domElement.remove();
				ctx = null;
			}
		};
	});

	$effect(() => {
		if (!ready) return;
		// Read the settings so this effect re-runs when they change.
		void [container.widthCm, container.depthCm, container.heightCm, container.doorSide];
		buildContainer();
		view('3d');
	});

	$effect(() => {
		if (!ready) return;
		// Deep read of the props so any change (position, size, kind, highlight, selection) re-syncs.
		void JSON.stringify(boxes);
		void JSON.stringify(highlighted);
		void selectedId;
		sync();
	});
</script>

<div
	class="relative h-full w-full overflow-hidden rounded-xl border border-stone-200 shadow-inner"
	style="background: linear-gradient(180deg, #e9eef3 0%, #d9e0e7 60%, #cfd6dc 100%)"
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={wrapper}
		class="h-full w-full touch-none"
		{onpointerdown}
		{onpointermove}
		{onpointerup}
		onpointercancel={onpointerup}
		onpointerleave={() => {
			if (hoveredId && !drag) {
				hoveredId = null;
				wrapper.style.cursor = 'default';
				sync();
			}
		}}
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
