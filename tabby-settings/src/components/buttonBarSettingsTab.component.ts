import { Component } from '@angular/core'
import { ConfigService } from 'tabby-core'

interface ButtonBarButton {
    id: string
    label: string
    command: string
    type?: 'terminal' | 'app-command'
    icon?: string
    tooltip?: string
    color?: string
}

/** @hidden */
@Component({
    selector: 'button-bar-settings-tab',
    templateUrl: './buttonBarSettingsTab.component.pug',
})
export class ButtonBarSettingsTabComponent {
    constructor (
        public config: ConfigService,
    ) {}

    toggleEnabled (enabled: boolean): void {
        if (!this.config.store.buttonBar) {
            this.config.store.buttonBar = {
                enabled: enabled,
                collapsed: true,
                buttons: [],
            }
        } else {
            this.config.store.buttonBar.enabled = enabled
        }
        this.config.save()
    }

    toggleCollapsed (collapsed: boolean): void {
        if (this.config.store.buttonBar) {
            this.config.store.buttonBar.collapsed = collapsed
            this.config.save()
        }
    }

    toggleProfileSidebarEnabled (enabled: boolean): void {
        if (!this.config.store.profileSidebar) {
            this.config.store.profileSidebar = {
                enabled: enabled,
                collapsed: true,
            }
        } else {
            this.config.store.profileSidebar.enabled = enabled
        }
        this.config.save()
    }

    toggleProfileSidebarCollapsed (collapsed: boolean): void {
        if (this.config.store.profileSidebar) {
            this.config.store.profileSidebar.collapsed = collapsed
            this.config.save()
        }
    }

    addButton (type: 'terminal' | 'app-command' = 'terminal'): void {
        // Initialize buttonBar config if it doesn't exist
        if (!this.config.store.buttonBar) {
            this.config.store.buttonBar = {
                enabled: true,
                collapsed: true,
                buttons: [],
            }
        }
        if (!this.config.store.buttonBar.buttons) {
            this.config.store.buttonBar.buttons = []
        }

        const newButton: ButtonBarButton = {
            id: 'custom_' + Date.now(),
            label: type === 'terminal' ? 'New Command' : 'New Action',
            command: type === 'terminal' ? 'echo "hello"' : '',
            type: type,
            color: type === 'terminal' ? '#007bff' : '#28a745',
            tooltip: type === 'terminal' ? 'Custom terminal command' : 'Custom app action',
        }

        this.config.store.buttonBar.buttons.push(newButton)
        this.config.save()
        this.reloadButtonBar()
    }

    removeButton (index: number): void {
        if (this.config.store.buttonBar?.buttons) {
            this.config.store.buttonBar.buttons.splice(index, 1)
            this.config.save()
            this.reloadButtonBar()
        }
    }

    updateButtonLabel (index: number, label: string): void {
        if (this.config.store.buttonBar?.buttons?.[index]) {
            this.config.store.buttonBar.buttons[index].label = label
            this.config.save()
        }
    }

    updateButtonCommand (index: number, command: string): void {
        if (this.config.store.buttonBar?.buttons?.[index]) {
            this.config.store.buttonBar.buttons[index].command = command
            this.config.save()
        }
    }

    updateButtonColor (index: number, color: string): void {
        if (this.config.store.buttonBar?.buttons?.[index]) {
            this.config.store.buttonBar.buttons[index].color = color
            this.config.save()
        }
    }

    updateButtonTooltip (index: number, tooltip: string): void {
        if (this.config.store.buttonBar?.buttons?.[index]) {
            this.config.store.buttonBar.buttons[index].tooltip = tooltip
            this.config.save()
        }
    }

    updateButtonType (index: number, type: string): void {
        if (this.config.store.buttonBar?.buttons?.[index]) {
            this.config.store.buttonBar.buttons[index].type = type as 'terminal' | 'app-command'
            // Clear the command when switching types
            this.config.store.buttonBar.buttons[index].command = ''
            this.config.save()
        }
    }

    moveButtonUp (index: number): void {
        if (index > 0 && this.config.store.buttonBar?.buttons) {
            const buttons = this.config.store.buttonBar.buttons
            const temp = buttons[index]
            buttons[index] = buttons[index - 1]
            buttons[index - 1] = temp
            this.config.save()
            this.reloadButtonBar()
        }
    }

    moveButtonDown (index: number): void {
        if (this.config.store.buttonBar?.buttons && index < this.config.store.buttonBar.buttons.length - 1) {
            const buttons = this.config.store.buttonBar.buttons
            const temp = buttons[index]
            buttons[index] = buttons[index + 1]
            buttons[index + 1] = temp
            this.config.save()
            this.reloadButtonBar()
        }
    }

    saveChanges (): void {
        this.config.save()
        this.reloadButtonBar()
    }

    private reloadButtonBar (): void {
        // The button bar will automatically reload when config changes
    }

    resetToDefaults (): void {
        this.config.store.buttonBar = {
            enabled: true,
            collapsed: true,
            buttons: [
                {
                    id: 'ls',
                    label: 'ls',
                    command: 'ls -la',
                    color: '#007bff',
                    tooltip: 'List files with details',
                },
                {
                    id: 'pwd',
                    label: 'pwd',
                    command: 'pwd',
                    color: '#28a745',
                    tooltip: 'Show current directory',
                },
                {
                    id: 'clear',
                    label: 'clear',
                    command: 'clear',
                    color: '#ffc107',
                    tooltip: 'Clear terminal screen',
                },
                {
                    id: 'top',
                    label: 'top',
                    command: 'top',
                    color: '#dc3545',
                    tooltip: 'Show running processes',
                },
            ],
        }
        this.config.save()
        this.reloadButtonBar()
    }
}
