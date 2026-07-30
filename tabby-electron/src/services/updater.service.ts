import { Injectable } from '@angular/core'

import { Logger, LogService, ConfigService, UpdaterService, PlatformService, TranslateService } from 'tabby-core'
import { ElectronService } from '../services/electron.service'

@Injectable()
export class ElectronUpdaterService extends UpdaterService {
    private logger: Logger
    private downloaded: Promise<boolean>
    private electronUpdaterAvailable = true
    private updateURL: string

    constructor (
        log: LogService,
        config: ConfigService,
        private translate: TranslateService,
        private platform: PlatformService,
        private electron: ElectronService,
    ) {
        super()
        this.logger = log.create('updater')

        if (process.platform === 'linux' || process.env.PORTABLE_EXECUTABLE_FILE) {
            this.electronUpdaterAvailable = false
            return
        }

        this.electron.ipcRenderer.on('updater:update-available', () => {
            this.logger.info('Update available')
        })

        this.electron.ipcRenderer.on('updater:update-not-available', () => {
            this.logger.info('No updates')
        })

        this.electron.ipcRenderer.on('updater:error', err => {
            this.logger.error(err)
            this.electronUpdaterAvailable = false
        })

        this.downloaded = new Promise<boolean>(resolve => {
            this.electron.ipcRenderer.once('updater:update-downloaded', () => resolve(true))
        })
    }

    async check (): Promise<boolean> {
        return Promise.resolve(false)
    }

    async update (): Promise<void> {
        if (!this.electronUpdaterAvailable) {
            await this.electron.shell.openExternal(this.updateURL)
        } else {
            if ((await this.platform.showMessageBox(
                {
                    type: 'warning',
                    message: this.translate.instant('Installing the update will close all tabs and restart Tabby.'),
                    buttons: [
                        this.translate.instant('Update'),
                        this.translate.instant('Cancel'),
                    ],
                    defaultId: 0,
                    cancelId: 1,
                },
            )).response === 0) {
                await this.downloaded
                this.electron.ipcRenderer.send('updater:quit-and-install')
            }
        }
    }
}
