import { Vec3 } from 'cc';
import {
    VehicleColor,
    VehicleCapacity,
    IVehicleInitConfig,
    IPassengerInitConfig,
    IParkingSlotInfo,
    ParkingSlotIndex,
    WaypointType,
    RouteWaypointConfig,
    BusStopConfig,
    PassengerGroupConfig,
    LevelVehicleConfig,
    VehicleColumnConfig,
} from './GameDefines';

export type IBusStopStationConfig = BusStopConfig;

export class LevelData {
    public static readonly MAX_ROAD_CAPACITY: number = 4;

    public static readonly DEFAULT_LANE_START_POSITIONS: Vec3[] = [
        new Vec3(-5.0, 0.0, -5.0),
        new Vec3(-7.2, 0.0, -5.0),
        new Vec3(-9.4, 0.0, -5.0),
    ];

    public static readonly DEFAULT_VEHICLE_SPACING: number = 3.5;
    public static readonly DEFAULT_LANE_QUEUE_DIRECTION: Vec3 = new Vec3(0, 0, -1);
    public static readonly DEFAULT_PASSENGER_SPACING: number = 1.0;
    public static readonly PASSENGER_SPACING: number = 1.0;

    public static readonly MAIN_ROUTE_WAYPOINTS: RouteWaypointConfig[] = [
        new RouteWaypointConfig(new Vec3(0.0, 0.0, -4.5), WaypointType.Normal),
        new RouteWaypointConfig(new Vec3(0.0, 0.0, -1.0), WaypointType.Normal),
        new RouteWaypointConfig(new Vec3(0.0, 0.0, 1.36), WaypointType.BusStop, 'stop_1'),
        new RouteWaypointConfig(new Vec3(0.0, 0.0, 5.0), WaypointType.Normal),
        new RouteWaypointConfig(new Vec3(1.5, 0.0, 7.5), WaypointType.Normal),
        new RouteWaypointConfig(new Vec3(3.5, 0.0, 7.0), WaypointType.Normal),
        new RouteWaypointConfig(new Vec3(3.5, 0.0, 2.0), WaypointType.Normal),
        new RouteWaypointConfig(new Vec3(3.5, 0.0, -2.0), WaypointType.Normal),
        new RouteWaypointConfig(new Vec3(3.5, 0.0, -6.5), WaypointType.ParkingApproach),
    ];

    public static readonly EXIT_GATE_POINT: Vec3 = new Vec3(8.0, 0.0, 1.36);

    public static readonly BUS_STOP_CONFIGS: BusStopConfig[] = [
        new BusStopConfig(
            'stop_1',
            'Bus Stop 1',
            new Vec3(6.051, 0.0, 7.479),
            1.0,
            new Vec3(1, 0, 0),
            [
                new PassengerGroupConfig(VehicleColor.Green, 4),
                new PassengerGroupConfig(VehicleColor.Blue, 5),
            ]
        ),
        new BusStopConfig(
            'stop_3',
            'Bus Stop 3',
            new Vec3(-4.94, 0.0, 10.003),
            1.0,
            new Vec3(-1, 0, 0),
            [
                new PassengerGroupConfig(VehicleColor.Red, 6),
                new PassengerGroupConfig(VehicleColor.Yellow, 4),
            ]
        ),
        new BusStopConfig(
            'stop_2',
            'Bus Stop 2',
            new Vec3(-6.277, 0.0, 1.301),
            1.0,
            new Vec3(-1, 0, 0),
            [
                new PassengerGroupConfig(VehicleColor.Blue, 5),
                new PassengerGroupConfig(VehicleColor.Red, 4),
            ]
        ),
    ];

    public static readonly PARKING_SLOTS: IParkingSlotInfo[] = [
        {
            index: ParkingSlotIndex.Slot1,
            name: 'Slot 1',
            worldPosition: new Vec3(2.837, 0.062, -8.925),
            isReserved: false,
            occupantId: null,
        },
        {
            index: ParkingSlotIndex.Slot2,
            name: 'Slot 2',
            worldPosition: new Vec3(0.748, 0.062, -8.925),
            isReserved: false,
            occupantId: null,
        },
        {
            index: ParkingSlotIndex.Slot3,
            name: 'Slot 3',
            worldPosition: new Vec3(-1.344, 0.062, -8.925),
            isReserved: false,
            occupantId: null,
        },
        {
            index: ParkingSlotIndex.Slot4,
            name: 'Slot 4',
            worldPosition: new Vec3(-3.409, 0.062, -8.925),
            isReserved: false,
            occupantId: null,
        },
    ];

    public static getDefaultMainRoute(): RouteWaypointConfig[] {
        return LevelData.MAIN_ROUTE_WAYPOINTS.map(
            (wp) => new RouteWaypointConfig(wp.position, wp.type, wp.busStopId)
        );
    }

    public static getDefaultBusStopConfigs(): BusStopConfig[] {
        return LevelData.BUS_STOP_CONFIGS.map(
            (b) =>
                new BusStopConfig(
                    b.id,
                    b.name,
                    b.headPosition,
                    b.spacing,
                    b.queueDirection,
                    b.passengers.map((p) => new PassengerGroupConfig(p.color, p.count))
                )
        );
    }

    public static getDefaultVehicleColumns(): VehicleColumnConfig[] {
        return [
            new VehicleColumnConfig([
                new LevelVehicleConfig(VehicleColor.Red, VehicleCapacity.Six),
                new LevelVehicleConfig(VehicleColor.Blue, VehicleCapacity.Ten),
            ]),
            new VehicleColumnConfig([
                new LevelVehicleConfig(VehicleColor.Green, VehicleCapacity.Four),
                new LevelVehicleConfig(VehicleColor.Yellow, VehicleCapacity.Four),
                new LevelVehicleConfig(VehicleColor.Red, VehicleCapacity.Four),
            ]),
        ];
    }

    public static getInitialVehicles(
        lanePositions: Vec3[] = LevelData.DEFAULT_LANE_START_POSITIONS,
        spacing: number = LevelData.DEFAULT_VEHICLE_SPACING,
        direction: Vec3 = LevelData.DEFAULT_LANE_QUEUE_DIRECTION,
        customColumns?: VehicleColumnConfig[]
    ): IVehicleInitConfig[] {
        const dir = direction.clone().normalize();
        const columns = customColumns && customColumns.length > 0 ? customColumns : LevelData.getDefaultVehicleColumns();

        const calculatePos = (laneIdx: number, queueIdx: number) => {
            const basePos = (lanePositions && lanePositions[laneIdx])
                ? lanePositions[laneIdx]
                : (lanePositions && lanePositions[0]
                    ? new Vec3(lanePositions[0].x - laneIdx * 2.2, lanePositions[0].y, lanePositions[0].z)
                    : new Vec3(-5.0 - laneIdx * 2.2, 0.0, -5.0));

            return new Vec3(
                basePos.x + dir.x * (queueIdx * spacing),
                basePos.y + dir.y * (queueIdx * spacing),
                basePos.z + dir.z * (queueIdx * spacing)
            );
        };

        const result: IVehicleInitConfig[] = [];
        let autoIdCounter = 0;

        for (let colIdx = 0; colIdx < columns.length; colIdx++) {
            const col = columns[colIdx];
            if (!col || !col.vehicles) continue;

            for (let qIdx = 0; qIdx < col.vehicles.length; qIdx++) {
                const v = col.vehicles[qIdx];
                if (!v) continue;

                result.push({
                    id: `bus_${autoIdCounter++}`,
                    color: v.color,
                    capacity: v.capacity,
                    laneIndex: colIdx,
                    queueIndex: qIdx,
                    initialPosition: calculatePos(colIdx, qIdx),
                    initialEulerY: 0,
                });
            }
        }

        return result;
    }

    public static getInitialPassengers(): IPassengerInitConfig[] {
        const result: IPassengerInitConfig[] = [];

        for (let i = 0; i < LevelData.BUS_STOP_CONFIGS.length; i++) {
            const b = LevelData.BUS_STOP_CONFIGS[i];
            let pCounter = 0;
            for (let j = 0; j < b.passengers.length; j++) {
                const grp = b.passengers[j];
                const count = Math.max(0, Math.floor(grp.count || 0));
                for (let k = 0; k < count; k++) {
                    result.push({
                        id: `${b.id}_p_${pCounter++}`,
                        color: grp.color,
                        busStopId: b.id,
                    });
                }
            }
        }

        return result;
    }
}
