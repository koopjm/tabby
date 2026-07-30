import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core'
import { Subject } from 'rxjs'
import { AppService } from '../services/app.service'
import { NotificationsService } from '../services/notifications.service'
import { HotkeysService } from '../services/hotkeys.service'
import { SplitTabComponent } from './splitTab.component'

export interface ButtonBarButton {
    id: string
    label: string
    command: string
    type?: 'terminal' | 'app-command'
    icon?: string
    tooltip?: string
    color?: string
}

@Component({
    selector: 'button-bar',
    template: `
        <div class="button-bar" [class.collapsed]="collapsed" [class.expanded]="!collapsed">
            <div class="button-bar-header" (click)="toggleCollapse()">
                <span class="toggle-icon">{{ collapsed ? '▼' : '▲' }}</span>
                <span class="header-text">Quick Commands</span>
                <span class="spacer"></span>
                <button class="btn btn-sm btn-outline-secondary hide-button" (click)="$event.stopPropagation(); hideBar()">
                    ×
                </button>
            </div>
            <div class="button-bar-content" *ngIf="!collapsed">
                <button
                    *ngFor="let button of buttons"
                    class="btn btn-sm btn-secondary btn-quick-command"
                    [style.background-color]="button.color || '#6c757d'"
                    [ngbTooltip]="button.tooltip || button.label"
                    (click)="sendCommand($event, button)"
                    (contextmenu)="showButtonContextMenu($event, button)"
                >
                    <span *ngIf="button.icon" class="button-icon" [innerHTML]="button.icon"></span>
                    <span class="button-label">{{ button.label }}</span>
                </button>
            </div>
        </div>
    `,
    styles: [`
        .button-bar {
            position: relative;
            width: 100%;
            background: rgba(0, 0, 0, 0.9);
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            z-index: 100;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        }

        .button-bar.collapsed {
            height: 32px;
        }

        .button-bar.expanded {
            height: auto;
            min-height: 72px;
        }

        .button-bar-header {
            height: 32px;
            display: flex;
            align-items: center;
            padding: 0 12px;
            cursor: pointer;
            user-select: none;
            background: rgba(0, 0, 0, 0.8);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .toggle-icon {
            margin-right: 8px;
            font-size: 12px;
            color: #aaa;
            transition: transform 0.2s ease;
        }

        .header-text {
            color: #aaa;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }

        .spacer {
            flex: 1;
        }

        .hide-button {
            padding: 2px 8px;
            font-size: 14px;
            line-height: 1;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: transparent;
            color: #aaa;
        }

        .hide-button:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
        }

        .button-bar-content {
            padding: 12px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            align-items: center;
        }

        .btn-quick-command {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            font-size: 12px;
            border: none;
            border-radius: 4px;
            color: white;
            transition: all 0.2s ease;
        }

        .btn-quick-command:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            filter: brightness(1.1);
        }

        .button-icon {
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .button-label {
            white-space: nowrap;
        }
    `]
})
export class ButtonBarComponent implements OnInit, OnDestroy {
    @Input() buttons: ButtonBarButton[] = []
    @Input() collapsed: boolean = false
    @Output() collapsedChange = new EventEmitter<boolean>()
    @Output() hide = new EventEmitter<void>()

    private destroy$ = new Subject<void>()

    constructor(
        private app: AppService,
        private notifications: NotificationsService,
        private hotkeys: HotkeysService,
    ) {}

    ngOnInit() {
        // Set default collapsed state if not specified
        if (typeof this.collapsed === 'undefined') {
            this.collapsed = true
        }
        this.updateButtonBarHeight()
    }

    ngOnDestroy() {
        this.destroy$.next()
        this.destroy$.complete()
    }

    toggleCollapse() {
        this.collapsed = !this.collapsed
        this.collapsedChange.emit(this.collapsed)
        this.updateButtonBarHeight()
    }

    hideBar() {
        this.hide.emit()
    }

    sendCommand(event: MouseEvent, button: ButtonBarButton) {
        const type = button.type || 'terminal'  // Default to terminal if not specified

        if (type === 'app-command') {
            // Trigger app command using hotkeys service
            // Access the private _hotkey subject to manually fire the hotkey
            if (button.command) {
                (this.hotkeys as any)._hotkey.next(button.command)
                this.notifications.notice(`App command triggered: ${button.label}`)
            } else {
                this.notifications.error('No app command configured', 'Please configure an app command for this button.')
            }
        } else {
            // Send terminal command
            const activeTab = this.app.activeTab
            this._send(activeTab, button.command, true)
        }
        (event.target as HTMLElement).blur()

        // Defer re-selecting the active tab to ensure its focus is re-asserted
        setTimeout(() => {
            if (this.app.activeTab) {
                this.app.selectTab(this.app.activeTab)
            }
        }, 0)
    }

    private async _send(tab: any, cmd: string, appendCR: boolean) {
        if (!tab) {
            this.notifications.error('No active tab', 'Please open a terminal tab first.')
            return
        }

        // Handle split tabs - get the focused tab
        if (tab instanceof SplitTabComponent) {
            this._send((tab as SplitTabComponent).getFocusedTab(), cmd, appendCR)
            return
        }

        // Check if it's a terminal tab by looking for sendInput method and session
        if (typeof tab.sendInput === 'function') {
            if (tab.session) {
                // Send the command with a newline to execute it
                tab.sendInput(cmd + (appendCR ? '\n' : ''))

                // Show a subtle notification that the command was sent
                this.notifications.notice(`Command sent: ${cmd}`)
            } else {
                this.notifications.error('No active terminal session', 'Please ensure you have an active terminal session to send commands.')
            }
        } else {
            this.notifications.error('Not a terminal tab', 'Please switch to a terminal tab to use quick commands.')
        }
    }

    showButtonContextMenu(event: MouseEvent, button: ButtonBarButton) {
        event.preventDefault()
        event.stopPropagation()

        // Show a notification about the configuration
        this.notifications.info(
            'Button Configuration',
            `Right-click detected! To configure "${button.label}" button, go to Settings > Button Bar. You can also edit the config file directly.`
        )
    }

    private updateButtonBarHeight() {
        // Set CSS custom property for button bar height
        // Use setTimeout to ensure DOM is updated first
        setTimeout(() => {
            const height = this.collapsed ? '32px' : '72px'
            document.documentElement.style.setProperty('--button-bar-height', height)
        }, 0)
    }
}
