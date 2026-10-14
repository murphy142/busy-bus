import { _decorator, Component, Node, Vec3, tween, SkeletalAnimation, MeshRenderer, Material } from 'cc';
import { VehicleColor, COLOR_PALETTE } from '../configs/GameDefines';

const { ccclass, property } = _decorator;

@ccclass('PassengerController')
export class PassengerController extends Component {
    @property
    public passengerId: string = '';
    public busStopId: string = 'stop_1';

    public color: VehicleColor = VehicleColor.Red;
    public isBoarding: boolean = false;

    private _anim: SkeletalAnimation | null = null;
    private _meshRenderer: MeshRenderer | null = null;

    protected onLoad(): void {
        this._anim = this.getComponent(SkeletalAnimation) || this.getComponentInChildren(SkeletalAnimation);
        this._meshRenderer = this.getComponent(MeshRenderer) || this.getComponentInChildren(MeshRenderer);
    }

    public init(id: string, color: VehicleColor, busStopId: string = 'stop_1'): void {
        this.passengerId = id;
        this.color = color;
        this.busStopId = busStopId;
        this.isBoarding = false;
        this.applyColor(color);
        this.playIdle();
    }

    public applyColor(color: VehicleColor): void {
        this.color = color;
        if (!this._meshRenderer) {
            this._meshRenderer = this.getComponent(MeshRenderer) || this.getComponentInChildren(MeshRenderer);
        }

        if (this._meshRenderer) {
            const palette = COLOR_PALETTE[color];
            if (palette) {
                const mat = this._meshRenderer.getMaterialInstance(0);
                if (mat) {
                    mat.setProperty('mainColor', palette.mainColor);
                    mat.setProperty('baseColor', palette.outlineColor);
                }
            }
        }
    }

    public playIdle(): void {
        if (this._anim) {
            const state = this._anim.getState('Idle.animation') || this._anim.getState('Idle');
            if (state) {
                this._anim.play(state.name);
            } else if (this._anim.clips.length > 0) {
                this._anim.play(this._anim.clips[0].name);
            }
        }
    }

    public playWalk(): void {
        if (this._anim) {
            const state = this._anim.getState('Walk.animation') || this._anim.getState('Walk');
            if (state) {
                this._anim.play(state.name);
            } else if (this._anim.clips.length > 1) {
                this._anim.play(this._anim.clips[1].name);
            }
        }
    }

    public playSit(): void {
        if (this._anim) {
            const state = this._anim.getState('Sit.animation') || this._anim.getState('Sit');
            if (state) {
                this._anim.play(state.name);
            } else if (this._anim.clips.length > 2) {
                this._anim.play(this._anim.clips[2].name);
            }
        }
    }

    public advanceToPosition(targetPos: Vec3, onComplete?: () => void): void {
        this.playWalk();
        const startPos = this.node.worldPosition.clone();
        const duration = Math.min(0.4, Math.max(0.15, Vec3.distance(startPos, targetPos) / 4.0));

        tween(this.node)
            .to(duration, { worldPosition: targetPos })
            .call(() => {
                this.playIdle();
                if (onComplete) {
                    onComplete();
                }
            })
            .start();
    }

    public boardVehicle(doorWorldPos: Vec3, onComplete: () => void): void {
        if (this.isBoarding) {
            return;
        }
        this.isBoarding = true;
        this.playWalk();

        tween(this.node)
            .to(0.35, { worldPosition: doorWorldPos })
            .call(() => {
                this.playSit();
            })
            .to(0.15, { scale: new Vec3(0, 0, 0) })
            .call(() => {
                this.node.active = false;
                onComplete();
            })
            .start();
    }
}
