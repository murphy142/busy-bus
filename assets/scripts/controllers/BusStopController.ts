import { _decorator, Component, Vec3, Node } from 'cc';
import { LevelData, IBusStopStationConfig } from '../configs/LevelData';
import { PassengerController } from './PassengerController';
import { VehicleController } from './VehicleController';
import { RoadRouteManager } from '../managers/RoadRouteManager';

const { ccclass, property } = _decorator;

export interface IBusStopStationRuntime {
    id: string;
    name: string;
    headPosition: Vec3;
    spacing: number;
    queueDirection: Vec3;
    passengers: PassengerController[];
}

@ccclass('BusStopController')
export class BusStopController extends Component {
    private static _instance: BusStopController | null = null;

    public static get instance(): BusStopController {
        if (!this._instance) {
            const placeholder = new BusStopController();
            placeholder.initDefaultStations();
            this._instance = placeholder;
        }
        return this._instance;
    }

    private _stations: Map<string, IBusStopStationRuntime> = new Map();
    private _activeBoardingStations: Set<string> = new Set();

    protected onLoad(): void {
        BusStopController._instance = this;
        this.initDefaultStations();
    }

    protected onDestroy(): void {
        if (BusStopController._instance === this) {
            BusStopController._instance = null;
        }
        this._stations.clear();
        this._activeBoardingStations.clear();
    }

    public initDefaultStations(): void {
        this._stations.clear();
        const configs = RoadRouteManager.instance.getBusStopConfigs();
        const finalConfigs = configs && configs.length > 0 ? configs : LevelData.BUS_STOP_CONFIGS;

        for (let i = 0; i < finalConfigs.length; i++) {
            const cfg = finalConfigs[i];
            this._stations.set(cfg.id, {
                id: cfg.id,
                name: cfg.name || `Bus Stop ${cfg.id}`,
                headPosition: cfg.headPosition.clone(),
                spacing: cfg.spacing,
                queueDirection: cfg.queueDirection.clone(),
                passengers: [],
            });
        }
    }

    public setStationLayout(
        stationId: string,
        headPos: Vec3,
        spacing: number = 1.0,
        direction: Vec3 = new Vec3(-1, 0, 0)
    ): void {
        let station = this._stations.get(stationId);
        if (!station) {
            station = {
                id: stationId,
                name: `Bus Stop ${stationId}`,
                headPosition: headPos.clone(),
                spacing: spacing,
                queueDirection: direction.clone().normalize(),
                passengers: [],
            };
            this._stations.set(stationId, station);
        } else {
            station.headPosition = headPos.clone();
            station.spacing = spacing;
            station.queueDirection = direction.clone().normalize();
        }
    }

    public setPassengerQueue(passengerList: PassengerController[]): void {
        this._stations.forEach((st) => (st.passengers = []));

        if (this._stations.size === 0) {
            this.initDefaultStations();
        }

        for (let i = 0; i < passengerList.length; i++) {
            const p = passengerList[i];
            const targetStationId = p.busStopId;

            if (!targetStationId) {
                console.warn(`[BusStopController] Passenger '${p.passengerId}' has no busStopId specified! Passenger will NOT be added to any queue.`);
                continue;
            }

            const station = this._stations.get(targetStationId);
            if (!station) {
                console.warn(
                    `[BusStopController] Passenger '${p.passengerId}' references unknown busStopId '${targetStationId}'! Available stations: [${Array.from(this._stations.keys()).join(', ')}]. Passenger will NOT be added to any queue.`
                );
                continue;
            }

            station.passengers.push(p);
        }

        this._stations.forEach((st) => {
            this.updateStationPassengerPositions(st);
        });
    }

    public isQueueEmpty(): boolean {
        let allEmpty = true;
        this._stations.forEach((st) => {
            if (st.passengers.length > 0) {
                allEmpty = false;
            }
        });
        return allEmpty;
    }

    private updateStationPassengerPositions(station: IBusStopStationRuntime): void {
        const headPos = station.headPosition;
        const spacing = station.spacing;
        const dir = station.queueDirection;

        for (let i = 0; i < station.passengers.length; i++) {
            const p = station.passengers[i];
            if (p && p.node && p.node.isValid) {
                const offset = new Vec3(dir.x * i * spacing, dir.y * i * spacing, dir.z * i * spacing);
                const targetPos = new Vec3(headPos.x + offset.x, headPos.y + offset.y, headPos.z + offset.z);

                p.node.setWorldPosition(targetPos);
                p.node.setRotationFromEuler(0, 90, 0);
                p.playIdle();
            }
        }
    }

    private advanceStationQueueOneStep(station: IBusStopStationRuntime): void {
        const headPos = station.headPosition;
        const spacing = station.spacing;
        const dir = station.queueDirection;

        for (let i = 0; i < station.passengers.length; i++) {
            const p = station.passengers[i];
            if (p && p.node && p.node.isValid) {
                const offset = new Vec3(dir.x * i * spacing, dir.y * i * spacing, dir.z * i * spacing);
                const targetPos = new Vec3(headPos.x + offset.x, headPos.y + offset.y, headPos.z + offset.z);
                p.advanceToPosition(targetPos);
            }
        }
    }

    public handleVehicleArrived(vehicle: VehicleController, busStopId: string = 'stop_1'): void {
        const station = this._stations.get(busStopId);
        if (!station) {
            console.warn(
                `[BusStopController] Vehicle arrived at unregistered busStopId '${busStopId}'! Available stations: [${Array.from(this._stations.keys()).join(', ')}]. Please check your Inspector waypoint and bus stop configs.`
            );
            this.finishBoardingForVehicle(vehicle, busStopId);
            return;
        }

        if (this._activeBoardingStations.has(busStopId)) {
            console.warn(`[BusStopController] Boarding already in progress for station '${busStopId}'.`);
            return;
        }

        if (station.passengers.length === 0) {
            this.finishBoardingForVehicle(vehicle, busStopId);
            return;
        }

        this._activeBoardingStations.add(busStopId);
        this.processNextPassengerForVehicle(vehicle, station);
    }

    private processNextPassengerForVehicle(vehicle: VehicleController, station: IBusStopStationRuntime): void {
        if (vehicle.isFull()) {
            this.finishBoardingForVehicle(vehicle, station.id);
            return;
        }

        if (station.passengers.length === 0) {
            this.finishBoardingForVehicle(vehicle, station.id);
            return;
        }

        const headPassenger = station.passengers[0];
        if (!headPassenger || headPassenger.color !== vehicle.color) {
            this.finishBoardingForVehicle(vehicle, station.id);
            return;
        }

        station.passengers.shift();
        this.advanceStationQueueOneStep(station);

        const busPos = vehicle.node.worldPosition;
        const doorPos = new Vec3(busPos.x - 0.8, busPos.y, busPos.z);

        headPassenger.boardVehicle(doorPos, () => {
            vehicle.addPassenger();
            this.processNextPassengerForVehicle(vehicle, station);
        });
    }

    private finishBoardingForVehicle(vehicle: VehicleController, stationId?: string): void {
        if (stationId) {
            this._activeBoardingStations.delete(stationId);
        } else {
            this._activeBoardingStations.clear();
        }
        vehicle.resumeRouteAfterBusStop();
    }
}
