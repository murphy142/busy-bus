import { _decorator, Component, Node, Vec3 } from 'cc';
import { LevelData } from '../configs/LevelData';
import { ParkingSlotIndex, IParkingSlotInfo } from '../configs/GameDefines';
import { VehicleController } from '../controllers/VehicleController';

const { ccclass, property } = _decorator;

export interface IParkingSlotRuntime {
    index: ParkingSlotIndex;
    name: string;
    worldPosition: Vec3;
    isReserved: boolean;
    occupant: VehicleController | null;
    slotNode: Node | null;
}

@ccclass('ParkingManager')
export class ParkingManager extends Component {
    private static _instance: ParkingManager | null = null;

    public static get instance(): ParkingManager {
        if (!this._instance) {
            const placeholder = new ParkingManager();
            placeholder.initFromConfig();
            this._instance = placeholder;
        }
        return this._instance;
    }

    private _slots: IParkingSlotRuntime[] = [];

    protected onLoad(): void {
        ParkingManager._instance = this;
        this.initFromConfig();
    }

    protected onDestroy(): void {
        if (ParkingManager._instance === this) {
            ParkingManager._instance = null;
        }
        this._slots = [];
    }

    public initFromConfig(slotNodes?: Node[]): void {
        this._slots = [];
        const configSlots = LevelData.PARKING_SLOTS;

        for (let i = 0; i < configSlots.length; i++) {
            const cfg = configSlots[i];
            const node = slotNodes && slotNodes[i] ? slotNodes[i] : null;

            this._slots.push({
                index: cfg.index,
                name: cfg.name,
                worldPosition: node ? node.worldPosition.clone() : cfg.worldPosition.clone(),
                isReserved: false,
                occupant: null,
                slotNode: node,
            });
        }
    }

    public getFirstAvailableSlot(): IParkingSlotRuntime | null {
        for (let i = 0; i < this._slots.length; i++) {
            const slot = this._slots[i];
            if (!slot.isReserved && slot.occupant === null) {
                slot.isReserved = true;
                return slot;
            }
        }
        return null;
    }

    public assignVehicleToSlot(slotIndex: number, vehicle: VehicleController): void {
        const slot = this._slots[slotIndex];
        if (slot) {
            slot.occupant = vehicle;
            slot.isReserved = false;
        }
    }

    public releaseSlot(slotIndex: number): void {
        const slot = this._slots[slotIndex];
        if (slot) {
            slot.occupant = null;
            slot.isReserved = false;
        }
    }

    public isAllSlotsOccupied(): boolean {
        for (let i = 0; i < this._slots.length; i++) {
            const slot = this._slots[i];
            if (!slot.isReserved && slot.occupant === null) {
                return false;
            }
        }
        return true;
    }

    public getSlot(slotIndex: number): IParkingSlotRuntime | null {
        return this._slots[slotIndex] || null;
    }

    public reset(): void {
        for (let i = 0; i < this._slots.length; i++) {
            this._slots[i].isReserved = false;
            this._slots[i].occupant = null;
        }
    }
}
