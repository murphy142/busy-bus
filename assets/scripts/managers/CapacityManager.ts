import { _decorator, Component } from 'cc';
import { LevelData } from '../configs/LevelData';

const { ccclass, property } = _decorator;

export type CapacityChangeCallback = (current: number, max: number) => void;

@ccclass('CapacityManager')
export class CapacityManager extends Component {
    private static _instance: CapacityManager | null = null;

    public static get instance(): CapacityManager {
        if (!this._instance) {
            const placeholder = new CapacityManager();
            placeholder.init(LevelData.MAX_ROAD_CAPACITY);
            this._instance = placeholder;
        }
        return this._instance;
    }

    @property
    public maxCapacity: number = LevelData.MAX_ROAD_CAPACITY;

    private _currentRoadVehicles: number = 0;
    private _listeners: CapacityChangeCallback[] = [];

    protected onLoad(): void {
        CapacityManager._instance = this;
        this._currentRoadVehicles = 0;
    }

    protected onDestroy(): void {
        if (CapacityManager._instance === this) {
            CapacityManager._instance = null;
        }
        this._listeners = [];
    }

    public init(maxCap: number): void {
        this.maxCapacity = maxCap;
        this._currentRoadVehicles = 0;
        this.notifyChange();
    }

    public get currentRoadVehicles(): number {
        return this._currentRoadVehicles;
    }

    public canEnterRoad(): boolean {
        return this._currentRoadVehicles < this.maxCapacity;
    }

    public acquireRoadSlot(): boolean {
        if (!this.canEnterRoad()) {
            return false;
        }

        this._currentRoadVehicles++;
        this.notifyChange();
        return true;
    }

    public releaseRoadSlot(): boolean {
        if (this._currentRoadVehicles <= 0) {
            console.warn('[CapacityManager] releaseRoadSlot called but current count is already 0.');
            return false;
        }

        this._currentRoadVehicles--;
        this.notifyChange();
        return true;
    }

    public reset(): void {
        this._currentRoadVehicles = 0;
        this.notifyChange();
    }

    public addListener(callback: CapacityChangeCallback): void {
        if (this._listeners.indexOf(callback) === -1) {
            this._listeners.push(callback);
            callback(this._currentRoadVehicles, this.maxCapacity);
        }
    }

    public removeListener(callback: CapacityChangeCallback): void {
        const index = this._listeners.indexOf(callback);
        if (index !== -1) {
            this._listeners.splice(index, 1);
        }
    }

    private notifyChange(): void {
        for (let i = 0; i < this._listeners.length; i++) {
            this._listeners[i](this._currentRoadVehicles, this.maxCapacity);
        }
    }
}
