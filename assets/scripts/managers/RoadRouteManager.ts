import { _decorator, Component, Vec3, math } from 'cc';
import { LevelData } from '../configs/LevelData';
import { RouteWaypointConfig, BusStopConfig, WaypointType } from '../configs/GameDefines';

const { ccclass, property } = _decorator;

@ccclass('RoadRouteManager')
export class RoadRouteManager extends Component {
    private static _instance: RoadRouteManager | null = null;

    public static get instance(): RoadRouteManager {
        if (!this._instance) {
            const placeholder = new RoadRouteManager();
            placeholder.initFallbackData();
            this._instance = placeholder;
        }
        return this._instance;
    }

    @property({
        type: [RouteWaypointConfig],
        tooltip:
            'Danh sách Waypoint tuần tự của tuyến đường chính. Chỉnh sửa tọa độ, chọn loại (Normal/BusStop/ParkingApproach) và nhập busStopId trực tiếp tại đây.',
    })
    public mainRouteWaypoints: RouteWaypointConfig[] = LevelData.getDefaultMainRoute();

    @property({
        type: [BusStopConfig],
        tooltip:
            'Danh sách cấu hình các điểm đón khách (Bus Stops). Chỉnh sửa ID, tên, vị trí xếp hàng, khoảng cách và hướng trực tiếp tại đây.',
    })
    public busStopConfigs: BusStopConfig[] = LevelData.getDefaultBusStopConfigs();

    @property({ tooltip: 'Điểm Cổng Thoát (Exit Gate) khi xe đầy rời màn chơi' })
    public exitGatePoint: Vec3 = LevelData.EXIT_GATE_POINT.clone();

    protected onLoad(): void {
        RoadRouteManager._instance = this;

        if (!this.mainRouteWaypoints || this.mainRouteWaypoints.length === 0) {
            this.mainRouteWaypoints = LevelData.getDefaultMainRoute();
        }
        if (!this.busStopConfigs || this.busStopConfigs.length === 0) {
            this.busStopConfigs = LevelData.getDefaultBusStopConfigs();
        }
    }

    protected onDestroy(): void {
        if (RoadRouteManager._instance === this) {
            RoadRouteManager._instance = null;
        }
    }

    private initFallbackData(): void {
        if (!this.mainRouteWaypoints || this.mainRouteWaypoints.length === 0) {
            this.mainRouteWaypoints = LevelData.getDefaultMainRoute();
        }
        if (!this.busStopConfigs || this.busStopConfigs.length === 0) {
            this.busStopConfigs = LevelData.getDefaultBusStopConfigs();
        }
    }

    public getMainRoute(): RouteWaypointConfig[] {
        if (!this.mainRouteWaypoints || this.mainRouteWaypoints.length === 0) {
            this.initFallbackData();
        }
        return this.mainRouteWaypoints;
    }

    public getBusStopConfigs(): BusStopConfig[] {
        if (!this.busStopConfigs || this.busStopConfigs.length === 0) {
            this.initFallbackData();
        }
        return this.busStopConfigs;
    }

    public getRouteLength(): number {
        return this.getMainRoute().length;
    }

    public getWaypoint(index: number): RouteWaypointConfig | null {
        const route = this.getMainRoute();
        if (index >= 0 && index < route.length) {
            return route[index];
        }
        return null;
    }

    public getRouteEntryPoint(): Vec3 {
        const route = this.getMainRoute();
        return route.length > 0 ? route[0].position.clone() : new Vec3(0, 0, -4.5);
    }

    public getQueueToRouteEntry(startPos: Vec3): Vec3[] {
        const entryPoint = this.getRouteEntryPoint();
        return [
            new Vec3(startPos.x, 0.0, entryPoint.z),
            entryPoint.clone(),
        ];
    }

    public getParkingSlotToRouteEntry(slotIndex: number): Vec3[] {
        const slot = LevelData.PARKING_SLOTS[slotIndex];
        const startPos = slot ? slot.worldPosition : new Vec3(0, 0, -8.925);
        const entryPoint = this.getRouteEntryPoint();

        return [
            new Vec3(startPos.x, 0.0, -6.5),
            entryPoint.clone(),
        ];
    }

    public getExitRouteFrom(currentPos: Vec3): Vec3[] {
        const exitPoint = this.exitGatePoint;
        return [
            currentPos.clone(),
            new Vec3((currentPos.x + exitPoint.x) * 0.5, 0.0, currentPos.z),
            exitPoint.clone(),
            new Vec3(exitPoint.x + 4.0, 0.0, exitPoint.z),
        ];
    }

    public getApproachToParkingSlotRoute(slotIndex: number): Vec3[] {
        const slot = LevelData.PARKING_SLOTS[slotIndex];
        const targetPos = slot ? slot.worldPosition : new Vec3(0, 0, -8.925);
        const route = this.getMainRoute();
        const approachPoint = route.length > 0 ? route[route.length - 1].position : new Vec3(3.5, 0, -6.5);

        return [
            approachPoint.clone(),
            new Vec3(targetPos.x, 0.0, approachPoint.z),
            new Vec3(targetPos.x, targetPos.y, targetPos.z),
        ];
    }

    public static calculateLookAtEulerY(from: Vec3, to: Vec3): number {
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) {
            return 0;
        }
        const rad = Math.atan2(dx, dz);
        return math.toDegree(rad);
    }
}
