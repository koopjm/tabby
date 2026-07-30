import { ConfigProvider } from './api/configProvider'
import { Platform } from './api/hostApp'

/** @hidden */
export class CoreConfigProvider extends ConfigProvider {
    platformDefaults = {
        [Platform.macOS]: require('./configDefaults.macos.yaml').default,
        [Platform.Windows]: require('./configDefaults.windows.yaml').default,
        [Platform.Linux]: require('./configDefaults.linux.yaml').default,
        [Platform.Web]: require('./configDefaults.web.yaml').default,
    }

    defaults = require('./configDefaults.yaml').default
}

/** @hidden */
export class ButtonBarConfigProvider extends ConfigProvider {
    defaults = {
        buttonBar: {
            enabled: true,
            collapsed: true,
            buttons: [
                {
                    id: 'ls',
                    label: 'ls',
                    command: 'ls -la',
                    color: '#007bff',
                    tooltip: 'List files with details'
                },
                {
                    id: 'pwd',
                    label: 'pwd',
                    command: 'pwd',
                    color: '#28a745',
                    tooltip: 'Show current directory'
                },
                {
                    id: 'clear',
                    label: 'clear',
                    command: 'clear',
                    color: '#dc3545',
                    tooltip: 'Clear terminal'
                },
                {
                    id: 'git-status',
                    label: 'git status',
                    command: 'git status',
                    color: '#6f42c1',
                    tooltip: 'Git status'
                },
                {
                    id: 'docker-ps',
                    label: 'docker ps',
                    command: 'docker ps',
                    color: '#17a2b8',
                    tooltip: 'List Docker containers'
                }
            ]
        },
        profileSidebar: {
            enabled: true,
            collapsed: false
        }
    }
}
