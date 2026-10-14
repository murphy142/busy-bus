import { _decorator, Color, Vec3, Enum } from 'cc';

const { ccclass, property } = _decorator;

export enum VehicleColor {
    Red = 'Red',
    Blue = 'Blue',
    Green = 'Green',
    Yellow = 'Yellow',
}
Enum(VehicleColor);

export enum VehicleCapacity {
    Four = 4,
    Six = 6,
    Ten = 10,
}
Enum(VehicleCapacity);

export enum VehicleState {
    InQueue = 'InQueue',
    MovingToRoad = 'MovingToRoad',
    MovingOnRoad = 'MovingOnRoad',
    AtBusStop = 'AtBusStop',
    Leaving = 'Leaving',
    Exited = 'Exited',
    MovingToParking = 'MovingToParking',
    Parked = 'Parked',
    MovingFromParkingToRoad = 'MovingFromParkingToRoad',
}

export enum GameState {
    Ready = 'Ready',
    Playing = 'Playing',
    Victory = 'Victory',
    Defeat = 'Defeat',
}

export enum ParkingSlotIndex {
    Slot1 = 0,
    Slot2 = 1,
    Slot3 = 2,
    Slot4 = 3,
}

export enum WaypointType {
    Normal = 0,
    BusStop = 1,
    ParkingApproach = 2,
}
Enum(WaypointType);

@ccclass('RouteWaypointConfig')
export class RouteWaypointConfig {
    @property({ type: Vec3, tooltip: 'Tọa độ X, Y, Z của waypoint' })
    public position: Vec3 = new Vec3();

    @property({
        type: Enum(WaypointType),
        tooltip: 'Loại waypoint: Normal (lướt qua), BusStop (đón khách), ParkingApproach (rẽ vào bãi đỗ)',
    })
    public type: WaypointType = WaypointType.Normal;

    @property({ tooltip: 'ID của bến xe tương ứng (chỉ dùng khi type là BusStop, ví dụ: stop_1)' })
    public busStopId: string = '';

    constructor(pos?: Vec3, type?: WaypointType, busStopId?: string) {
        if (pos) this.position = pos.clone();
        if (type !== undefined) this.type = type;
        if (busStopId !== undefined) this.busStopId = busStopId;
    }
}

export type IRouteWaypoint = RouteWaypointConfig;

@ccclass('PassengerGroupConfig')
export class PassengerGroupConfig {
    @property({ type: Enum(VehicleColor), tooltip: 'Màu sắc của nhóm hành khách' })
    public color: VehicleColor = VehicleColor.Red;

    @property({ tooltip: 'Số lượng hành khách liên tiếp có cùng màu này' })
    public count: number = 1;

    constructor(color?: VehicleColor, count?: number) {
        if (color !== undefined) this.color = color;
        if (count !== undefined) this.count = count;
    }
}

export type PassengerQueueConfig = PassengerGroupConfig;

@ccclass('BusStopConfig')
export class BusStopConfig {
    @property({ tooltip: 'Mã định danh duy nhất của bến xe (dùng để liên kết với busStopId trên waypoint và hành khách)' })
    public id: string = 'stop_1';

    @property({ tooltip: 'Tên bến xe hiển thị' })
    public name: string = 'Bus Stop 1';

    @property({ type: Vec3, tooltip: 'Vị trí bắt đầu xếp hàng của hành khách tại bến xe này' })
    public headPosition: Vec3 = new Vec3(-2.2, 0.0, 1.36);

    @property({ tooltip: 'Khoảng cách giữa các hành khách trong hàng đợi' })
    public spacing: number = 1.0;

    @property({ type: Vec3, tooltip: 'Hướng xếp hàng lùi dần của hành khách' })
    public queueDirection: Vec3 = new Vec3(-1, 0, 0);

    @property({
        type: [PassengerGroupConfig],
        tooltip: 'Danh sách các nhóm hành khách xếp hàng tại bến xe này theo thứ tự từ đầu hàng đến cuối hàng. Mỗi phần tử chỉ gồm Màu sắc và Số lượng (count).',
    })
    public passengers: PassengerGroupConfig[] = [];

    constructor(
        id?: string,
        name?: string,
        headPos?: Vec3,
        spacing?: number,
        dir?: Vec3,
        passengers?: PassengerGroupConfig[]
    ) {
        if (id !== undefined) this.id = id;
        if (name !== undefined) this.name = name;
        if (headPos) this.headPosition = headPos.clone();
        if (spacing !== undefined) this.spacing = spacing;
        if (dir) this.queueDirection = dir.clone();
        if (passengers) this.passengers = passengers;
    }
}

@ccclass('LevelVehicleConfig')
export class LevelVehicleConfig {
    @property({ type: Enum(VehicleColor), tooltip: 'Màu sắc của xe' })
    public color: VehicleColor = VehicleColor.Red;

    @property({ type: Enum(VehicleCapacity), tooltip: 'Sức chứa ghế ngồi (Four: 4 chỗ, Six: 6 chỗ, Ten: 10 chỗ)' })
    public capacity: VehicleCapacity = VehicleCapacity.Four;

    constructor(color?: VehicleColor, capacity?: VehicleCapacity) {
        if (color !== undefined) this.color = color;
        if (capacity !== undefined) this.capacity = capacity;
    }
}

@ccclass('VehicleColumnConfig')
export class VehicleColumnConfig {
    @property({
        type: [LevelVehicleConfig],
        tooltip: 'Danh sách các xe trong cột này (theo thứ tự từ đầu hàng đến cuối hàng)',
    })
    public vehicles: LevelVehicleConfig[] = [];

    constructor(vehicles?: LevelVehicleConfig[]) {
        if (vehicles) this.vehicles = vehicles;
    }
}

export const COLOR_PALETTE: Record<VehicleColor, { mainColor: Color; outlineColor: Color }> = {
    [VehicleColor.Red]: {
        mainColor: new Color(225, 40, 50, 255),
        outlineColor: new Color(115, 0, 0, 255),
    },
    [VehicleColor.Blue]: {
        mainColor: new Color(35, 125, 240, 255),
        outlineColor: new Color(10, 45, 130, 255),
    },
    [VehicleColor.Green]: {
        mainColor: new Color(45, 195, 75, 255),
        outlineColor: new Color(15, 90, 30, 255),
    },
    [VehicleColor.Yellow]: {
        mainColor: new Color(245, 185, 25, 255),
        outlineColor: new Color(140, 95, 10, 255),
    },
};

export interface IVehicleInitConfig {
    id: string;
    color: VehicleColor;
    capacity: VehicleCapacity;
    laneIndex: number;
    queueIndex: number;
    initialPosition: Vec3;
    initialEulerY: number;
}

export interface IPassengerInitConfig {
    id: string;
    color: VehicleColor;
    busStopId?: string;
}

export interface IParkingSlotInfo {
    index: ParkingSlotIndex;
    name: string;
    worldPosition: Vec3;
    isReserved: boolean;
    occupantId: string | null;
}
