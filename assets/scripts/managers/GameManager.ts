import {
    _decorator,
    Component,
    Node,
    Camera,
    Vec3,
    input,
    Input,
    EventTouch,
    geometry,
    instantiate,
    Tween,
    tween,
} from 'cc';
import {
    GameState,
    VehicleState,
    VehicleColor,
    VehicleCapacity,
    LevelVehicleConfig,
    VehicleColumnConfig,
    IPassengerInitConfig,
} from '../configs/GameDefines';
import { LevelData } from '../configs/LevelData';
import { CapacityManager } from './CapacityManager';
import { ParkingManager } from './ParkingManager';
import { RoadRouteManager } from './RoadRouteManager';
import { VehicleController } from '../controllers/VehicleController';
import { PassengerController } from '../controllers/PassengerController';
import { BusStopController } from '../controllers/BusStopController';
import { UIController } from '../controllers/UIController';

const { ccclass, property } = _decorator;

export type GameStateChangeCallback = (state: GameState, extra?: any) => void;

@ccclass('GameManager')
export class GameManager extends Component {
    private static _instance: GameManager | null = null;

    public static get instance(): GameManager {
        return this._instance!;
    }

    @property(Camera)
    public mainCamera: Camera | null = null;

    @property({ type: Node, tooltip: 'Node mẫu xe 4 chỗ trong Hierarchy (mặc định tìm Vehicle_04)' })
    public vehicleTemplate4: Node | null = null;

    @property({ type: Node, tooltip: 'Node mẫu xe 6 chỗ trong Hierarchy (mặc định tìm Vehicle_06)' })
    public vehicleTemplate6: Node | null = null;

    @property({ type: Node, tooltip: 'Node mẫu xe 10 chỗ trong Hierarchy (mặc định tìm Vehicle_10)' })
    public vehicleTemplate10: Node | null = null;

    @property({ type: Node, tooltip: 'Node mẫu dự phòng (fallback)' })
    public vehicleTemplate: Node | null = null;

    @property(Node)
    public passengerTemplate: Node | null = null;

    @property({
        type: [VehicleColumnConfig],
        tooltip:
            'Cấu hình các cột xe (Vehicle Columns). Cột 0 -> Làn 0, Cột 1 -> Làn 1, Cột 2 -> Làn 2... Trong mỗi cột, xe đầu tiên ở đầu hàng, các xe sau nối đuôi nhau. Mỗi xe chỉ cần chọn Màu và Sức chứa.',
    })
    public vehicleConfigs: VehicleColumnConfig[] = [];

    public get vehicleColumns(): VehicleColumnConfig[] {
        return this.vehicleConfigs;
    }
    public set vehicleColumns(val: VehicleColumnConfig[]) {
        this.vehicleConfigs = val;
    }

    @property({ type: [Vec3], tooltip: 'Vị trí xe đầu hàng của từng làn (Lane 0, Lane 1...). Bạn có thể chỉnh trực tiếp ở đây!' })
    public laneStartPositions: Vec3[] = LevelData.DEFAULT_LANE_START_POSITIONS.map((p) => p.clone());

    @property({ tooltip: 'Khoảng cách giữa các xe nối đuôi nhau trong cùng một làn' })
    public vehicleSpacingInLane: number = LevelData.DEFAULT_VEHICLE_SPACING;

    @property({ tooltip: 'Hướng xếp hàng lùi dần của xe trong làn (mặc định lùi theo Z âm: [0, 0, -1])' })
    public laneQueueDirection: Vec3 = LevelData.DEFAULT_LANE_QUEUE_DIRECTION.clone();

    @property({ tooltip: 'Tự động lấy vị trí khách đầu hàng từ vị trí node Stickman trong scene' })
    public useStickmanTemplatePosition: boolean = true;

    @property({ tooltip: 'Khoảng cách giữa các hành khách trong hàng đợi' })
    public passengerSpacing: number = LevelData.DEFAULT_PASSENGER_SPACING;

    @property({ type: UIController, tooltip: 'UIController quản lý popup Win/Lose (tùy chọn)' })
    public uiController: UIController | null = null;

    public gameState: GameState = GameState.Ready;

    private _allVehicles: VehicleController[] = [];

    public getAllVehicles(): VehicleController[] {
        return this._allVehicles;
    }

    private _lanes: VehicleController[][] = [];
    private _passengers: PassengerController[] = [];
    private _spawnContainer: Node | null = null;
    private _stateListeners: GameStateChangeCallback[] = [];

    protected onLoad(): void {
        GameManager._instance = this;

        if (!this.mainCamera) {
            this.mainCamera = this.node.scene.getComponentInChildren(Camera);
        }

        this.detectSceneTemplates();
        this.ensureUIController();

        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    }

    private ensureUIController(): void {
        if (this.uiController) {
            return;
        }

        let ui = this.node.getComponent(UIController);
        if (!ui && this.node.scene) {
            ui = this.node.scene.getComponentInChildren(UIController);
        }
        if (!ui) {
            ui = this.node.addComponent(UIController);
        }
        this.uiController = ui;
    }

    protected start(): void {
        this.startLevel();
    }

    protected onDestroy(): void {
        if (GameManager._instance === this) {
            GameManager._instance = null;
        }
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        this.clearSpawnedObjects();
    }

    private detectSceneTemplates(): void {
        const scene = this.node.scene;

        if (!this.vehicleTemplate4) {
            this.vehicleTemplate4 = scene.getChildByPath('Vehicle_04') || this.findNodeByName(scene, 'Vehicle_04');
        }
        if (!this.vehicleTemplate6) {
            this.vehicleTemplate6 = scene.getChildByPath('Vehicle_06') || this.findNodeByName(scene, 'Vehicle_06');
        }
        if (!this.vehicleTemplate10) {
            this.vehicleTemplate10 = scene.getChildByPath('Vehicle_10') || this.findNodeByName(scene, 'Vehicle_10');
        }
        if (!this.vehicleTemplate) {
            this.vehicleTemplate = this.vehicleTemplate4 || this.vehicleTemplate6 || this.vehicleTemplate10;
        }

        if (!this.passengerTemplate) {
            this.passengerTemplate = scene.getChildByPath('Stickman') || this.findNodeByName(scene, 'Stickman');
        }

        const parkingNodes: Node[] = [];
        this.findParkingNodesRecursive(scene, parkingNodes);

        if (parkingNodes.length >= 4) {
            parkingNodes.sort((a, b) => b.worldPosition.x - a.worldPosition.x);
            ParkingManager.instance.initFromConfig(parkingNodes);
        }
    }

    private findNodeByName(parent: Node, name: string): Node | null {
        if (parent.name === name) return parent;
        for (let i = 0; i < parent.children.length; i++) {
            const found = this.findNodeByName(parent.children[i], name);
            if (found) return found;
        }
        return null;
    }

    private findParkingNodesRecursive(parent: Node, outList: Node[]): void {
        if (parent.name === 'Parking') {
            outList.push(parent);
        }
        for (let i = 0; i < parent.children.length; i++) {
            this.findParkingNodesRecursive(parent.children[i], outList);
        }
    }

    public startLevel(): void {
        this.clearSpawnedObjects();

        this.gameState = GameState.Playing;
        CapacityManager.instance.reset();
        ParkingManager.instance.reset();

        this.syncPassengerQueueLayout();

        if (this.vehicleTemplate4) this.vehicleTemplate4.active = false;
        if (this.vehicleTemplate6) this.vehicleTemplate6.active = false;
        if (this.vehicleTemplate10) this.vehicleTemplate10.active = false;
        if (this.vehicleTemplate) this.vehicleTemplate.active = false;
        if (this.passengerTemplate) this.passengerTemplate.active = false;

        this._spawnContainer = new Node('SpawnContainer');
        this.node.scene.addChild(this._spawnContainer);

        this.spawnVehicles();
        this.spawnPassengers();

        this.notifyStateChange(GameState.Playing);
    }

    private syncPassengerQueueLayout(): void {
        BusStopController.instance.initDefaultStations();

        const configs = RoadRouteManager.instance.getBusStopConfigs();
        const hasMultipleOrCustomStations = configs && configs.length > 1;

        if (this.useStickmanTemplatePosition && this.passengerTemplate && this.passengerTemplate.isValid && !hasMultipleOrCustomStations) {
            const headPos = this.passengerTemplate.worldPosition.clone();
            const stationId = (configs && configs.length > 0) ? configs[0].id : 'stop_1';
            const defaultDir = (configs && configs.length > 0) ? configs[0].queueDirection : new Vec3(-1, 0, 0);

            BusStopController.instance.setStationLayout(
                stationId,
                headPos,
                this.passengerSpacing,
                defaultDir
            );
        }
    }

    public getLaneStartPosition(laneIndex: number): Vec3 {
        if (this.laneStartPositions && this.laneStartPositions.length > laneIndex && this.laneStartPositions[laneIndex]) {
            return this.laneStartPositions[laneIndex];
        }
        const refPos = (this.laneStartPositions && this.laneStartPositions.length > 0 && this.laneStartPositions[0])
            ? this.laneStartPositions[0]
            : LevelData.DEFAULT_LANE_START_POSITIONS[0];
        return new Vec3(refPos.x - laneIndex * 2.2, refPos.y, refPos.z);
    }

    private spawnVehicles(): void {
        this._allVehicles = [];
        this._lanes = [];

        let hasCustomVehicles = false;
        if (this.vehicleConfigs && this.vehicleConfigs.length > 0) {
            for (let c = 0; c < this.vehicleConfigs.length; c++) {
                if (this.vehicleConfigs[c].vehicles && this.vehicleConfigs[c].vehicles.length > 0) {
                    hasCustomVehicles = true;
                    break;
                }
            }
        }

        const customColumns = hasCustomVehicles ? this.vehicleConfigs : undefined;
        const vehicleConfigs = LevelData.getInitialVehicles(
            this.laneStartPositions,
            this.vehicleSpacingInLane,
            this.laneQueueDirection,
            customColumns
        );

        for (let i = 0; i < vehicleConfigs.length; i++) {
            const cfg = vehicleConfigs[i];

            let templateToUse: Node | null = null;
            if (cfg.capacity === VehicleCapacity.Six) {
                templateToUse = this.vehicleTemplate6 || this.vehicleTemplate;
            } else if (cfg.capacity === VehicleCapacity.Ten) {
                templateToUse = this.vehicleTemplate10 || this.vehicleTemplate;
            } else {
                templateToUse = this.vehicleTemplate4 || this.vehicleTemplate;
            }

            let vNode: Node;
            if (templateToUse) {
                vNode = instantiate(templateToUse);
            } else {
                vNode = new Node(`Vehicle_${cfg.id}`);
            }

            vNode.name = cfg.id;
            vNode.setWorldPosition(cfg.initialPosition);
            vNode.setRotationFromEuler(0, cfg.initialEulerY, 0);
            vNode.active = true;
            this._spawnContainer?.addChild(vNode);

            let ctrl = vNode.getComponent(VehicleController);
            if (!ctrl) {
                ctrl = vNode.addComponent(VehicleController);
            }

            ctrl.init(cfg.id, cfg.color, cfg.capacity, cfg.laneIndex, cfg.queueIndex);
            this.bindVehicleEvents(ctrl);

            this._allVehicles.push(ctrl);

            if (!this._lanes[cfg.laneIndex]) {
                this._lanes[cfg.laneIndex] = [];
            }
            this._lanes[cfg.laneIndex].push(ctrl);
        }

        this.updateLaneHeadVehicles();
    }

    private updateLaneHeadVehicles(): void {
        for (let laneIdx = 0; laneIdx < this._lanes.length; laneIdx++) {
            const lane = this._lanes[laneIdx];
            for (let qIdx = 0; qIdx < lane.length; qIdx++) {
                lane[qIdx].isHeadOfQueue = qIdx === 0;
            }
        }
    }

    private handleVehicleDepartedFromQueue(vehicle: VehicleController): void {
        const lane = this._lanes[vehicle.laneIndex];
        if (!lane) return;

        const idx = lane.indexOf(vehicle);
        if (idx !== -1) {
            lane.splice(idx, 1);

            const basePos = this.getLaneStartPosition(vehicle.laneIndex);
            const dir = this.laneQueueDirection.clone().normalize();
            const spacing = this.vehicleSpacingInLane;

            for (let i = 0; i < lane.length; i++) {
                const nextVehicle = lane[i];
                nextVehicle.queueIndex = i;
                nextVehicle.isHeadOfQueue = i === 0;

                const targetPos = new Vec3(
                    basePos.x + dir.x * (i * spacing),
                    basePos.y + dir.y * (i * spacing),
                    basePos.z + dir.z * (i * spacing)
                );

                tween(nextVehicle.node).to(0.4, { worldPosition: targetPos }).start();
            }
        }
    }

    private getEffectivePassengerConfigs(): IPassengerInitConfig[] {
        if (RoadRouteManager.instance) {
            const stopConfigs = RoadRouteManager.instance.getBusStopConfigs();
            let hasInspectorPassengers = false;
            if (stopConfigs && stopConfigs.length > 0) {
                for (let i = 0; i < stopConfigs.length; i++) {
                    const sc = stopConfigs[i];
                    if (sc.passengers && sc.passengers.length > 0) {
                        for (let g = 0; g < sc.passengers.length; g++) {
                            const grp = sc.passengers[g];
                            const count = grp.count !== undefined ? Math.max(0, Math.floor(grp.count)) : 1;
                            if (count > 0) {
                                hasInspectorPassengers = true;
                                break;
                            }
                        }
                    }
                    if (hasInspectorPassengers) break;
                }
            }

            if (hasInspectorPassengers) {
                const result: IPassengerInitConfig[] = [];
                for (let i = 0; i < stopConfigs.length; i++) {
                    const sc = stopConfigs[i];
                    if (sc.passengers && sc.passengers.length > 0) {
                        let pCounter = 0;
                        for (let gIdx = 0; gIdx < sc.passengers.length; gIdx++) {
                            const grp = sc.passengers[gIdx];
                            const count = grp.count !== undefined ? Math.max(0, Math.floor(grp.count)) : 1;
                            for (let k = 0; k < count; k++) {
                                result.push({
                                    id: `${sc.id}_p_${pCounter++}`,
                                    color: grp.color,
                                    busStopId: sc.id,
                                });
                            }
                        }
                    }
                }
                return result;
            }
        }

        return LevelData.getInitialPassengers();
    }

    private spawnPassengers(): void {
        this._passengers = [];
        const passengerConfigs = this.getEffectivePassengerConfigs();

        for (let i = 0; i < passengerConfigs.length; i++) {
            const cfg = passengerConfigs[i];

            let pNode: Node;
            if (this.passengerTemplate) {
                pNode = instantiate(this.passengerTemplate);
            } else {
                pNode = new Node(`Passenger_${cfg.id}`);
            }

            pNode.name = cfg.id;
            pNode.active = true;
            this._spawnContainer?.addChild(pNode);

            let ctrl = pNode.getComponent(PassengerController);
            if (!ctrl) {
                ctrl = pNode.addComponent(PassengerController);
            }

            ctrl.init(cfg.id, cfg.color, cfg.busStopId || 'stop_1');
            this._passengers.push(ctrl);
        }

        BusStopController.instance.setPassengerQueue(this._passengers);
    }

    private bindVehicleEvents(vehicle: VehicleController): void {
        vehicle.onDepartedFromQueue = (v) => {
            this.handleVehicleDepartedFromQueue(v);
        };

        vehicle.onDepartedFromParking = (v, slotIndex) => {
            ParkingManager.instance.releaseSlot(slotIndex);
        };

        vehicle.onArrivedAtBusStop = (v, busStopId) => {
            BusStopController.instance.handleVehicleArrived(v, busStopId);
        };

        vehicle.onCompletedCircuit = (v) => {
            if (this.gameState !== GameState.Playing) return;

            if (v.isFull()) {
                v.departToExit();
                return;
            }

            const slot = ParkingManager.instance.getFirstAvailableSlot();

            if (slot !== null) {
                v.parkIntoSlot(slot.index, () => {
                    ParkingManager.instance.assignVehicleToSlot(slot.index, v);
                });
            } else {
                this.triggerDefeat(v);
            }
        };

        vehicle.onExited = (v) => {
            this.checkVictoryCondition();
        };
    }

    public checkVictoryCondition(): void {
        if (this.gameState !== GameState.Playing) return;

        let allExited = true;
        for (let i = 0; i < this._allVehicles.length; i++) {
            if (this._allVehicles[i].state !== VehicleState.Exited) {
                allExited = false;
                break;
            }
        }

        if (allExited) {
            this.triggerVictory();
        }
    }

    private triggerVictory(): void {
        if (this.gameState !== GameState.Playing) return;

        this.gameState = GameState.Victory;
        this.notifyStateChange(GameState.Victory);
    }

    public triggerDefeat(causeVehicle: VehicleController): void {
        if (this.gameState !== GameState.Playing) return;

        this.gameState = GameState.Defeat;
        this.notifyStateChange(GameState.Defeat, causeVehicle);
        console.warn(`[GameManager] DEFEAT! Vehicle ${causeVehicle.vehicleId} has no parking slot available!`);
    }

    private onTouchStart(event: EventTouch): void {
        if (this.gameState !== GameState.Playing) {
            return;
        }

        if (!this.mainCamera) {
            return;
        }

        const loc = event.getLocation();
        const ray = new geometry.Ray();
        this.mainCamera.screenPointToRay(loc.x, loc.y, ray);

        if (Math.abs(ray.d.y) < 0.0001) return;
        const t = -ray.o.y / ray.d.y;
        if (t < 0) return;

        const hitGroundX = ray.o.x + ray.d.x * t;
        const hitGroundZ = ray.o.z + ray.d.z * t;

        let bestCandidate: VehicleController | null = null;
        let bestDistance = 999;
        const TOUCH_RADIUS = 1.6;

        for (let i = 0; i < this._allVehicles.length; i++) {
            const v = this._allVehicles[i];
            if (!v || !v.node || !v.node.active) continue;

            if (v.state !== VehicleState.InQueue && v.state !== VehicleState.Parked) {
                continue;
            }

            const vPos = v.node.worldPosition;
            const dist = Math.hypot(hitGroundX - vPos.x, hitGroundZ - vPos.z);

            if (dist <= TOUCH_RADIUS && dist < bestDistance) {
                bestDistance = dist;
                bestCandidate = v;
            }
        }

        if (bestCandidate) {
            bestCandidate.handleTap();
        }
    }

    public restartLevel(): void {
        Tween.stopAll();
        this.startLevel();
    }

    private clearSpawnedObjects(): void {
        if (this._spawnContainer && this._spawnContainer.isValid) {
            this._spawnContainer.destroy();
            this._spawnContainer = null;
        }
        this._allVehicles = [];
        this._lanes = [];
        this._passengers = [];
    }

    public addStateListener(cb: GameStateChangeCallback): void {
        if (this._stateListeners.indexOf(cb) === -1) {
            this._stateListeners.push(cb);
        }
    }

    public removeStateListener(cb: GameStateChangeCallback): void {
        const idx = this._stateListeners.indexOf(cb);
        if (idx !== -1) {
            this._stateListeners.splice(idx, 1);
        }
    }

    private notifyStateChange(state: GameState, extra?: any): void {
        for (let i = 0; i < this._stateListeners.length; i++) {
            this._stateListeners[i](state, extra);
        }
    }
}
