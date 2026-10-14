import { _decorator, Component, Node, Vec3, tween, Tween, MeshRenderer, Quat, math } from 'cc';
import { VehicleColor, VehicleCapacity, VehicleState, COLOR_PALETTE, WaypointType } from '../configs/GameDefines';
import { CapacityManager } from '../managers/CapacityManager';
import { RoadRouteManager } from '../managers/RoadRouteManager';
import { GameManager } from '../managers/GameManager';
import { LevelData } from '../configs/LevelData';

const { ccclass, property } = _decorator;

export type VehicleEventCallback = (vehicle: VehicleController) => void;
export type VehicleBusStopCallback = (vehicle: VehicleController, busStopId: string) => void;

@ccclass('VehicleController')
export class VehicleController extends Component {
    @property
    public vehicleId: string = '';

    @property({ tooltip: 'Tốc độ di chuyển chung của xe (đơn vị thế giới/giây)' })
    public moveSpeed: number = 10.0;

    public color: VehicleColor = VehicleColor.Red;
    public capacity: VehicleCapacity = VehicleCapacity.Four;
    public currentPassengers: number = 0;
    public state: VehicleState = VehicleState.InQueue;

    public laneIndex: number = 0;
    public queueIndex: number = 0;
    public assignedSlotIndex: number = -1;

    public isHeadOfQueue: boolean = false;
    public hasAcquiredRoadCapacity: boolean = false;
    private _isInteracting: boolean = false;
    private _routeWaypointIndex: number = 0;
    private _hasAppliedFullVisual: boolean = false;

    private _lidNode: Node | null = null;
    private _bodyRenderer: MeshRenderer | null = null;
    private _lidRenderer: MeshRenderer | null = null;

    private _isMovingToTarget: boolean = false;
    private _currentTarget: Vec3 = new Vec3();
    private _targetSpeed: number = 8.0;
    private _targetOnComplete: (() => void) | null = null;

    private _isWaitingForLeadVehicle: boolean = false;
    private _waitingForVehicle: VehicleController | null = null;

    public get isWaitingForLeadVehicle(): boolean {
        return this._isWaitingForLeadVehicle;
    }

    public get waitingForVehicle(): VehicleController | null {
        return this._waitingForVehicle;
    }

    public onArrivedAtBusStop: VehicleBusStopCallback | null = null;
    public onCompletedCircuit: VehicleEventCallback | null = null;
    public onExited: VehicleEventCallback | null = null;
    public onDepartedFromQueue: VehicleEventCallback | null = null;
    public onDepartedFromParking: ((vehicle: VehicleController, slotIndex: number) => void) | null = null;

    protected onLoad(): void {
        this._targetSpeed = this.moveSpeed;
        this.cacheReferences();
    }

    protected onDestroy(): void {
        this._isMovingToTarget = false;
        this._targetOnComplete = null;
        this._isWaitingForLeadVehicle = false;
        this._waitingForVehicle = null;
    }

    private cacheReferences(): void {
        this._lidNode = this.node.getChildByPath('Body/Lid') || this.findNodeByNameRecursive(this.node, 'Lid');

        const renderers = this.node.getComponentsInChildren(MeshRenderer);
        for (let i = 0; i < renderers.length; i++) {
            const r = renderers[i];
            const name = r.node.name.toLowerCase();
            if (name.indexOf('lid') !== -1) {
                this._lidRenderer = r;
            } else if (name.indexOf('vehicle') !== -1 || name.indexOf('body') !== -1) {
                if (!this._bodyRenderer) {
                    this._bodyRenderer = r;
                }
            }
        }
    }

    private findNodeByNameRecursive(parent: Node, targetName: string): Node | null {
        if (parent.name.toLowerCase().indexOf(targetName.toLowerCase()) !== -1) {
            return parent;
        }
        for (let i = 0; i < parent.children.length; i++) {
            const found = this.findNodeByNameRecursive(parent.children[i], targetName);
            if (found) return found;
        }
        return null;
    }

    public init(
        id: string,
        color: VehicleColor,
        capacity: VehicleCapacity,
        laneIndex: number,
        queueIndex: number
    ): void {
        this.vehicleId = id;
        this.color = color;
        this.capacity = capacity;
        this.laneIndex = laneIndex;
        this.queueIndex = queueIndex;
        this.isHeadOfQueue = queueIndex === 0;
        this.currentPassengers = 0;
        this.state = VehicleState.InQueue;
        this.hasAcquiredRoadCapacity = false;
        this._isInteracting = false;
        this._isMovingToTarget = false;
        this._isWaitingForLeadVehicle = false;
        this._waitingForVehicle = null;
        this.assignedSlotIndex = -1;
        this._routeWaypointIndex = 0;
        this._hasAppliedFullVisual = false;

        this.applyColor(color);
        if (this.isFull()) {
            this._hasAppliedFullVisual = true;
            this.closeLid();
        } else {
            this.openLid();
        }
    }

    public applyColor(color: VehicleColor): void {
        this.color = color;
        const palette = COLOR_PALETTE[color];
        if (!palette) return;

        if (this._bodyRenderer) {
            const mat = this._bodyRenderer.getMaterialInstance(0);
            if (mat) {
                mat.setProperty('mainColor', palette.mainColor);
                mat.setProperty('baseColor', palette.outlineColor);
            }
        }

        if (this._lidRenderer) {
            const mat = this._lidRenderer.getMaterialInstance(0);
            if (mat) {
                mat.setProperty('mainColor', palette.mainColor);
                mat.setProperty('baseColor', palette.outlineColor);
            }
        }
    }

    public openLid(): void {
        if (this._lidNode) {
            this._lidNode.setPosition(0, 0.0, 0);
            this._lidNode.active = true;
        }
    }

    public closeLid(onComplete?: () => void): void {
        if (this._lidNode) {
            tween(this._lidNode)
                .to(0.2, { position: new Vec3(0, 1.0, 0) })
                .by(0.08, { position: new Vec3(0, -0.1, 0) })
                .to(0.06, { position: new Vec3(0, 1.0, 0) })
                .call(() => {
                    if (onComplete) onComplete();
                })
                .start();
        } else {
            if (onComplete) onComplete();
        }
    }

    public addPassenger(): boolean {
        if (this.currentPassengers < this.capacity) {
            this.currentPassengers++;

            if (this.isFull() && !this._hasAppliedFullVisual) {
                this._hasAppliedFullVisual = true;
                this.closeLid();
            }

            return true;
        }
        return false;
    }

    public isFull(): boolean {
        return this.currentPassengers >= this.capacity;
    }

    public handleTap(): boolean {
        if (this._isInteracting) {
            return false;
        }

        if (this.state === VehicleState.InQueue) {
            if (!this.isHeadOfQueue) {
                this.playRejectFeedback();
                return false;
            }
            return this.startDepartureFromQueue();
        } else if (this.state === VehicleState.Parked) {
            return this.startDepartureFromParking();
        }

        return false;
    }

    public startDepartureFromQueue(): boolean {
        if (!CapacityManager.instance.canEnterRoad()) {
            this.playRejectFeedback();
            return false;
        }

        if (!CapacityManager.instance.acquireRoadSlot()) {
            this.playRejectFeedback();
            return false;
        }

        this.hasAcquiredRoadCapacity = true;
        this._isInteracting = true;
        this.state = VehicleState.MovingToRoad;

        if (this.onDepartedFromQueue) {
            this.onDepartedFromQueue(this);
        }

        const branchRoute = RoadRouteManager.instance.getQueueToRouteEntry(this.node.worldPosition);
        this.followSimplePath(branchRoute, this.moveSpeed, () => {
            this._routeWaypointIndex = 0;
            this.state = VehicleState.MovingOnRoad;
            this.advanceAlongRoute();
        });

        return true;
    }

    public startDepartureFromParking(): boolean {
        if (!CapacityManager.instance.canEnterRoad()) {
            this.playRejectFeedback();
            return false;
        }

        if (!CapacityManager.instance.acquireRoadSlot()) {
            this.playRejectFeedback();
            return false;
        }

        const fromSlotIndex = this.assignedSlotIndex;
        this.hasAcquiredRoadCapacity = true;
        this._isInteracting = true;
        this.state = VehicleState.MovingFromParkingToRoad;

        if (this.onDepartedFromParking) {
            this.onDepartedFromParking(this, fromSlotIndex);
        }
        this.assignedSlotIndex = -1;

        const branchRoute = RoadRouteManager.instance.getParkingSlotToRouteEntry(fromSlotIndex);
        this.followSimplePath(branchRoute, this.moveSpeed, () => {
            this._routeWaypointIndex = 0;
            this.state = VehicleState.MovingOnRoad;
            this.advanceAlongRoute();
        });

        return true;
    }

    public advanceAlongRoute(): void {
        const totalWaypoints = RoadRouteManager.instance.getRouteLength();

        if (this._routeWaypointIndex >= totalWaypoints - 1) {
            this._isInteracting = false;
            if (this.isFull()) {
                this.departToExit();
            } else {
                if (this.onCompletedCircuit) {
                    this.onCompletedCircuit(this);
                }
            }
            return;
        }

        const nextIndex = this._routeWaypointIndex + 1;
        const nextWp = RoadRouteManager.instance.getWaypoint(nextIndex);

        if (!nextWp) {
            this._isInteracting = false;
            if (this.isFull()) {
                this.departToExit();
            } else {
                if (this.onCompletedCircuit) {
                    this.onCompletedCircuit(this);
                }
            }
            return;
        }

        this.state = VehicleState.MovingOnRoad;
        this._isInteracting = true;

        this.moveToSinglePoint(nextWp.position, this.moveSpeed, () => {
            this._routeWaypointIndex = nextIndex;

            if (nextWp.type === WaypointType.BusStop) {
                if (this.isFull()) {
                    this.advanceAlongRoute();
                } else {
                    this.state = VehicleState.AtBusStop;
                    this._isInteracting = false;
                    if (this.onArrivedAtBusStop) {
                        const stopId = nextWp.busStopId && nextWp.busStopId.trim() !== '' ? nextWp.busStopId : 'stop_1';
                        if (!nextWp.busStopId || nextWp.busStopId.trim() === '') {
                            console.warn(`[VehicleController] Waypoint #${nextIndex} is of type BusStop but has empty busStopId! Defaulting to 'stop_1'. Check Inspector waypoint config.`);
                        }
                        this.onArrivedAtBusStop(this, stopId);
                    }
                }
            } else if (nextWp.type === WaypointType.ParkingApproach) {
                this._isInteracting = false;
                if (this.isFull()) {
                    this.departToExit();
                } else {
                    if (this.onCompletedCircuit) {
                        this.onCompletedCircuit(this);
                    }
                }
            } else {
                this.advanceAlongRoute();
            }
        });
    }

    public resumeRouteAfterBusStop(): void {
        this.advanceAlongRoute();
    }

    public departToExit(): void {
        if (this.state === VehicleState.Leaving || this.state === VehicleState.Exited) {
            return;
        }

        this._isInteracting = true;
        this.state = VehicleState.Leaving;

        const proceedToExit = () => {
            const exitRoute = RoadRouteManager.instance.getExitRouteFrom(this.node.worldPosition);
            this.followSimplePath(exitRoute, this.moveSpeed, () => {
                this.state = VehicleState.Exited;
                this._isInteracting = false;

                if (this.hasAcquiredRoadCapacity) {
                    CapacityManager.instance.releaseRoadSlot();
                    this.hasAcquiredRoadCapacity = false;
                }

                this.node.active = false;
                if (this.onExited) {
                    this.onExited(this);
                }
            });
        };

        if (!this._hasAppliedFullVisual) {
            this._hasAppliedFullVisual = true;
            this.closeLid(() => proceedToExit());
        } else {
            proceedToExit();
        }
    }

    public parkIntoSlot(slotIndex: number, onParked: () => void): void {
        this._isInteracting = true;
        this.state = VehicleState.MovingToParking;
        this.assignedSlotIndex = slotIndex;

        const parkRoute = RoadRouteManager.instance.getApproachToParkingSlotRoute(slotIndex);
        this.followSimplePath(parkRoute, this.moveSpeed, () => {
            this.state = VehicleState.Parked;
            this._isInteracting = false;

            if (this.hasAcquiredRoadCapacity) {
                CapacityManager.instance.releaseRoadSlot();
                this.hasAcquiredRoadCapacity = false;
            }

            onParked();
        });
    }

    public getSafeStopDistance(leadVehicle?: VehicleController | null): number {
        const base = LevelData.DEFAULT_VEHICLE_SPACING;
        if (this.capacity === VehicleCapacity.Ten || (leadVehicle && leadVehicle.capacity === VehicleCapacity.Ten)) {
            return base + 0.3;
        }
        return base;
    }

    public getSafeResumeDistance(leadVehicle?: VehicleController | null): number {
        return this.getSafeStopDistance(leadVehicle) + 0.6;
    }

    public getMovementPriority(): number {
        switch (this.state) {
            case VehicleState.Leaving:
                return 60;
            case VehicleState.MovingToParking:
                return 50;
            case VehicleState.AtBusStop:
                return 40;
            case VehicleState.MovingOnRoad:
                return 30;
            case VehicleState.MovingFromParkingToRoad:
                return 20;
            case VehicleState.MovingToRoad:
                return 10;
            default:
                return 0;
        }
    }

    public shouldYieldTo(other: VehicleController): boolean {
        if (other._isWaitingForLeadVehicle && other._waitingForVehicle === this) {
            return false;
        }

        if (other.state === VehicleState.AtBusStop || (other._isWaitingForLeadVehicle && other._waitingForVehicle !== this)) {
            return true;
        }

        const myPriority = this.getMovementPriority();
        const otherPriority = other.getMovementPriority();
        if (myPriority !== otherPriority) {
            return otherPriority > myPriority;
        }

        const myDistToTarget = Vec3.distance(this.node.worldPosition, this._currentTarget);
        const otherDistToTarget = Vec3.distance(other.node.worldPosition, other._currentTarget);
        if (Math.abs(myDistToTarget - otherDistToTarget) > 0.05) {
            return otherDistToTarget < myDistToTarget;
        }

        return this.vehicleId > other.vehicleId;
    }

    private findLeadVehicleOnRoad(): VehicleController | null {
        if (!GameManager.instance) {
            return null;
        }

        const allVehicles = GameManager.instance.getAllVehicles();
        if (!allVehicles || allVehicles.length <= 1) {
            return null;
        }

        const myPos = this.node.worldPosition;
        const moveDir = new Vec3();
        Vec3.subtract(moveDir, this._currentTarget, myPos);
        moveDir.y = 0;
        if (moveDir.lengthSqr() < 0.001) {
            return null;
        }
        moveDir.normalize();

        const maxCheckDist = this.getSafeResumeDistance() + 2.0;
        let closestLead: VehicleController | null = null;
        let minDistance = maxCheckDist;

        for (let i = 0; i < allVehicles.length; i++) {
            const other = allVehicles[i];
            if (other === this || !other.node || !other.node.isValid || !other.node.active) {
                continue;
            }

            if (
                other.state === VehicleState.InQueue ||
                other.state === VehicleState.Parked ||
                other.state === VehicleState.Exited
            ) {
                continue;
            }

            const otherPos = other.node.worldPosition;
            const toOther = new Vec3();
            Vec3.subtract(toOther, otherPos, myPos);
            toOther.y = 0;
            const dist = toOther.length();
            if (dist > maxCheckDist) {
                continue;
            }
            if (dist < 0.01) {
                return other;
            }

            const forwardDist = Vec3.dot(moveDir, toOther);
            if (forwardDist <= 0.1) {
                continue;
            }

            const lateralDist = Math.abs(moveDir.x * toOther.z - moveDir.z * toOther.x);

            const isBothOnMainRoad =
                this.state === VehicleState.MovingOnRoad &&
                (other.state === VehicleState.MovingOnRoad || other.state === VehicleState.AtBusStop);
            const maxLateral = isBothOnMainRoad ? 2.5 : 1.7;

            if (lateralDist > maxLateral) {
                continue;
            }

            if (this.shouldYieldTo(other)) {
                if (dist < minDistance) {
                    minDistance = dist;
                    closestLead = other;
                }
            }
        }

        return closestLead;
    }

    protected update(dt: number): void {
        if (!this._isMovingToTarget) {
            return;
        }

        const leadVehicle = this.findLeadVehicleOnRoad();
        if (leadVehicle) {
            const distToLead = Vec3.distance(this.node.worldPosition, leadVehicle.node.worldPosition);
            const stopDist = this.getSafeStopDistance(leadVehicle);
            const resumeDist = this.getSafeResumeDistance(leadVehicle);

            if (!this._isWaitingForLeadVehicle) {
                if (distToLead <= stopDist) {
                    this._isWaitingForLeadVehicle = true;
                    this._waitingForVehicle = leadVehicle;
                    return;
                }
            } else {
                if (distToLead < resumeDist) {
                    this._waitingForVehicle = leadVehicle;
                    return;
                } else {
                    this._isWaitingForLeadVehicle = false;
                    this._waitingForVehicle = null;
                }
            }
        } else {
            this._isWaitingForLeadVehicle = false;
            this._waitingForVehicle = null;
        }

        const currentPos = this.node.worldPosition;
        const distToTarget = Vec3.distance(currentPos, this._currentTarget);
        const step = this._targetSpeed * dt;

        if (distToTarget <= step || distToTarget < 0.01) {
            this.node.setWorldPosition(this._currentTarget);
            this._isMovingToTarget = false;
            this._isWaitingForLeadVehicle = false;
            this._waitingForVehicle = null;

            const callback = this._targetOnComplete;
            this._targetOnComplete = null;
            if (callback) {
                callback();
            }
        } else {
            const dir = new Vec3();
            Vec3.subtract(dir, this._currentTarget, currentPos);
            dir.y = 0;
            dir.normalize();

            const nextPos = new Vec3(
                currentPos.x + dir.x * step,
                currentPos.y,
                currentPos.z + dir.z * step
            );
            this.node.setWorldPosition(nextPos);

            const targetEulerY = RoadRouteManager.calculateLookAtEulerY(currentPos, this._currentTarget);
            this.node.setRotationFromEuler(0, targetEulerY, 0);
        }
    }

    private moveToSinglePoint(target: Vec3, speed: number = this.moveSpeed, onComplete: () => void): void {
        Tween.stopAllByTarget(this.node);

        const currentPos = this.node.worldPosition;
        if (Vec3.distance(currentPos, target) < 0.01) {
            this._isMovingToTarget = false;
            this._isWaitingForLeadVehicle = false;
            this._waitingForVehicle = null;
            onComplete();
            return;
        }

        const targetEulerY = RoadRouteManager.calculateLookAtEulerY(currentPos, target);
        this.node.setRotationFromEuler(0, targetEulerY, 0);

        this._currentTarget.set(target);
        this._targetSpeed = speed !== undefined ? speed : this.moveSpeed;
        this._targetOnComplete = onComplete;
        this._isMovingToTarget = true;
        this._isWaitingForLeadVehicle = false;
        this._waitingForVehicle = null;
    }

    public followSimplePath(waypoints: Vec3[], speed: number = this.moveSpeed, onComplete: () => void): void {
        if (!waypoints || waypoints.length === 0) {
            this._isMovingToTarget = false;
            this._isWaitingForLeadVehicle = false;
            this._waitingForVehicle = null;
            onComplete();
            return;
        }

        Tween.stopAllByTarget(this.node);

        let idx = 0;
        const nextStep = () => {
            if (idx >= waypoints.length) {
                this._isMovingToTarget = false;
                this._isWaitingForLeadVehicle = false;
                this._waitingForVehicle = null;
                onComplete();
                return;
            }
            const pt = waypoints[idx++];
            this.moveToSinglePoint(pt, speed !== undefined ? speed : this.moveSpeed, () => {
                nextStep();
            });
        };
        nextStep();
    }

    public playRejectFeedback(): void {
        const origPos = this.node.position.clone();
        tween(this.node)
            .to(0.04, { position: new Vec3(origPos.x + 0.15, origPos.y, origPos.z) })
            .to(0.08, { position: new Vec3(origPos.x - 0.15, origPos.y, origPos.z) })
            .to(0.04, { position: origPos })
            .start();
    }
}
