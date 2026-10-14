import { _decorator, Component, Node, Label, Button } from 'cc';
import { GameState } from '../configs/GameDefines';
import { GameManager, GameStateChangeCallback } from '../managers/GameManager';

const { ccclass, property } = _decorator;

@ccclass('UIController')
export class UIController extends Component {
    private static _instance: UIController | null = null;

    public static get instance(): UIController | null {
        return this._instance;
    }

    @property({
        type: Node,
        tooltip: 'Node Popup Win/Lose trong Scene (tùy chọn, mặc định tự ẩn khi bắt đầu)',
    })
    public popupNode: Node | null = null;

    @property({
        type: Label,
        tooltip: 'Label tiêu đề hiển thị YOU WIN! hoặc YOU LOSE! (tùy chọn)',
    })
    public titleLabel: Label | null = null;

    @property({
        type: Button,
        tooltip: 'Nút Restart trong Inspector (tùy chọn)',
    })
    public restartButton: Button | null = null;

    @property({
        type: Node,
        tooltip: 'Node phủ mờ màn hình để chặn click vào gameplay (tùy chọn)',
    })
    public overlayNode: Node | null = null;

    private _hasShownPopup: boolean = false;
    private _domOverlayElement: HTMLElement | null = null;
    private _gameStateListener: GameStateChangeCallback | null = null;

    protected onLoad(): void {
        UIController._instance = this;
        this._hasShownPopup = false;

        if (this.popupNode) {
            this.popupNode.active = false;
        }
        if (this.overlayNode) {
            this.overlayNode.active = false;
        }

        if (this.restartButton) {
            this.restartButton.node.on(Button.EventType.CLICK, this.onRestartClicked, this);
        }
    }

    protected start(): void {
        this._gameStateListener = (state: GameState, extra?: any) => {
            this.handleGameStateChanged(state, extra);
        };

        if (GameManager.instance) {
            GameManager.instance.addStateListener(this._gameStateListener);
        }
    }

    protected onDestroy(): void {
        if (UIController._instance === this) {
            UIController._instance = null;
        }

        if (GameManager.instance && this._gameStateListener) {
            GameManager.instance.removeStateListener(this._gameStateListener);
            this._gameStateListener = null;
        }

        if (this.restartButton && this.restartButton.node && this.restartButton.node.isValid) {
            this.restartButton.node.off(Button.EventType.CLICK, this.onRestartClicked, this);
        }

        this.removeDomOverlay();
    }

    private handleGameStateChanged(state: GameState, extra?: any): void {
        if (this._hasShownPopup) {
            return;
        }

        if (state === GameState.Victory) {
            this.showWinPopup();
        } else if (state === GameState.Defeat) {
            this.showLosePopup();
        }
    }

    public showWinPopup(): void {
        if (this._hasShownPopup) return;
        this._hasShownPopup = true;

        if (this.popupNode) {
            if (this.titleLabel) {
                this.titleLabel.string = 'YOU WIN!';
            }
            if (this.overlayNode) {
                this.overlayNode.active = true;
            }
            this.popupNode.active = true;
            return;
        }

        this.createDomPopup(true, 'YOU WIN!');
    }

    public showLosePopup(): void {
        if (this._hasShownPopup) return;
        this._hasShownPopup = true;

        if (this.popupNode) {
            if (this.titleLabel) {
                this.titleLabel.string = 'YOU LOSE!';
            }
            if (this.overlayNode) {
                this.overlayNode.active = true;
            }
            this.popupNode.active = true;
            return;
        }

        this.createDomPopup(false, 'YOU LOSE!');
    }

    public onRestartClicked(): void {
        this.reloadPage();
    }

    public reloadPage(): void {
        if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
            window.location.reload();
        } else {
            console.warn('[UIController] window.location.reload is not supported in this runtime.');
        }
    }

    private createDomPopup(isWin: boolean, titleText: string): void {
        if (typeof document === 'undefined') {
            return;
        }

        this.removeDomOverlay();

        const overlay = document.createElement('div');
        overlay.id = 'busybus-result-popup';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.72)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '999999';
        overlay.style.pointerEvents = 'auto';
        overlay.style.touchAction = 'none';
        overlay.style.userSelect = 'none';
        overlay.style.fontFamily = 'Arial, Helvetica, sans-serif';

        const blockEvent = (e: Event) => {
            e.stopPropagation();
        };
        overlay.addEventListener('touchstart', blockEvent, { passive: false });
        overlay.addEventListener('touchend', blockEvent, { passive: false });
        overlay.addEventListener('touchmove', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
        overlay.addEventListener('mousedown', blockEvent);
        overlay.addEventListener('mouseup', blockEvent);
        overlay.addEventListener('click', blockEvent);

        const card = document.createElement('div');
        card.style.backgroundColor = '#1e293b';
        card.style.color = '#ffffff';
        card.style.padding = '36px 40px';
        card.style.borderRadius = '24px';
        card.style.textAlign = 'center';
        card.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 2px rgba(255, 255, 255, 0.15)';
        card.style.maxWidth = '88%';
        card.style.width = '340px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'center';
        card.style.gap = '20px';

        const title = document.createElement('div');
        title.innerText = titleText;
        title.style.fontSize = '38px';
        title.style.fontWeight = '900';
        title.style.letterSpacing = '1.5px';
        title.style.color = isWin ? '#22c55e' : '#ef4444';
        title.style.textShadow = isWin
            ? '0 0 24px rgba(34, 197, 94, 0.6)'
            : '0 0 24px rgba(239, 68, 68, 0.6)';

        const btn = document.createElement('button');
        btn.innerText = 'RESTART';
        btn.style.backgroundColor = isWin ? '#22c55e' : '#f59e0b';
        btn.style.color = '#ffffff';
        btn.style.border = 'none';
        btn.style.borderRadius = '14px';
        btn.style.padding = '14px 44px';
        btn.style.fontSize = '20px';
        btn.style.fontWeight = '800';
        btn.style.letterSpacing = '1.2px';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 10px 20px -5px rgba(0, 0, 0, 0.4)';
        btn.style.transition = 'transform 0.1s ease, filter 0.1s ease';
        btn.style.outline = 'none';

        btn.onmousedown = () => { btn.style.transform = 'scale(0.95)'; };
        btn.onmouseup = () => { btn.style.transform = 'scale(1)'; };
        btn.ontouchstart = () => { btn.style.transform = 'scale(0.95)'; };
        btn.ontouchend = () => { btn.style.transform = 'scale(1)'; };

        btn.onclick = (e) => {
            e.stopPropagation();
            this.reloadPage();
        };

        card.appendChild(title);
        card.appendChild(btn);
        overlay.appendChild(card);

        document.body.appendChild(overlay);
        this._domOverlayElement = overlay;
    }

    private removeDomOverlay(): void {
        if (this._domOverlayElement && this._domOverlayElement.parentNode) {
            this._domOverlayElement.parentNode.removeChild(this._domOverlayElement);
            this._domOverlayElement = null;
        }
    }
}
