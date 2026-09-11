import { Observable, Subject } from 'rxjs'
import { Injector } from '@angular/core'
import { ConfigService, LogService } from 'tabby-core'
import { PTYInterface } from 'tabby-local'
import { BaseSession, UTF8SplitterMiddleware, InputProcessor } from 'tabby-terminal'
import { SSHProfile } from '../api'

/**
 * SSH session using system SSH command instead of russh library
 * This provides better compatibility with OpenSSH servers, especially for X11 forwarding
 */
export class SystemSSHSession extends BaseSession {
    private pty: any = null
    private ptyClosed = false
    private profile: SSHProfile
    private config: ConfigService
    private ptyInterface: PTYInterface
    private serviceMessage = new Subject<string>()

    get serviceMessage$ (): Observable<string> { return this.serviceMessage }

    constructor (
        injector: Injector,
        profile: SSHProfile,
    ) {
        super(injector.get(LogService).create(`system-ssh-${profile.options.host}-${profile.options.port}`))
        this.profile = profile
        this.config = injector.get(ConfigService)
        this.ptyInterface = injector.get(PTYInterface)
        this.setLoginScriptsOptions(this.profile.options)
        this.middleware.push(new UTF8SplitterMiddleware())
        this.middleware.push(new InputProcessor(profile.options.input))
    }

    async start (): Promise<void> {
        this.logger.debug('Starting system SSH session')

        const sshCommand = this.buildSSHCommand()
        this.logger.debug('SSH command:', sshCommand.join(' '))

        this.emitServiceMessage(`Connecting via system SSH: ${sshCommand.join(' ')}`)

        // Set up environment
        const env: Record<string, string> = {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            TERM_PROGRAM: 'Tabby',
        }

        // Preserve DISPLAY for X11 forwarding
        if (process.env.DISPLAY) {
            env.DISPLAY = process.env.DISPLAY
        }

        try {
            this.pty = await this.ptyInterface.spawn(sshCommand[0], sshCommand.slice(1), {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                encoding: null,
                cwd: process.env.HOME,
                env,
            })

            this.open = true

            this.pty.subscribe('data', (array: Uint8Array) => {
                this.pty?.ackData(array.length)
                const data = Buffer.from(array)
                this.emitOutput(data)
            })

            this.pty.subscribe('exit', () => {
                this.logger.debug('SSH process exited')
                this.ptyClosed = true
                this.destroy()
            })

            this.pty.subscribe('close', () => {
                this.logger.debug('SSH process closed')
                this.ptyClosed = true
                this.destroy()
            })

            this.logger.debug('System SSH session started')
            this.emitServiceMessage('Connected via system SSH')

        } catch (error) {
            this.logger.error('Failed to start SSH process:', error)
            this.emitServiceMessage(`Failed to start SSH: ${error}`)
            throw error
        }
    }

    private buildSSHCommand (): string[] {
        const args = ['ssh']
        const options = this.profile.options

        // Basic connection options
        if (options.port && options.port !== 22) {
            args.push('-p', options.port.toString())
        }

        // X11 forwarding
        if (options.x11) {
            args.push('-X')
            this.emitServiceMessage('X11 forwarding enabled via system SSH')
        }

        // Agent forwarding
        if (options.agentForward) {
            args.push('-A')
        }

        // Compression (always enable for better performance)
        args.push('-C')

        // Verbose mode for debugging (can be controlled by config if needed)
        if (this.config.store.ssh.debug) {
            args.push('-v')
        }

        // Keep alive
        if (options.keepaliveInterval) {
            args.push('-o', `ServerAliveInterval=${Math.floor(options.keepaliveInterval / 1000)}`)
        }

        if (options.keepaliveCountMax) {
            args.push('-o', `ServerAliveCountMax=${options.keepaliveCountMax}`)
        }

        // Authentication options
        if (options.auth === 'password') {
            args.push('-o', 'PreferredAuthentications=password')
        } else if (options.auth === 'publicKey') {
            args.push('-o', 'PreferredAuthentications=publickey')
        } else if (options.auth === 'keyboardInteractive') {
            args.push('-o', 'PreferredAuthentications=keyboard-interactive')
        }

        // Private keys
        if (options.privateKeys.length > 0) {
            for (const keyPath of options.privateKeys) {
                args.push('-i', keyPath)
            }
        }

        // Proxy command
        if (options.proxyCommand) {
            args.push('-o', `ProxyCommand=${options.proxyCommand}`)
        }

        // Jump host
        if (options.jumpHost) {
            // This would need to be resolved to actual host details
            // For now, we'll skip this complex case
            this.logger.warn('Jump host not yet supported with system SSH')
        }

        // SOCKS proxy
        if (options.socksProxyHost) {
            const proxyPort = options.socksProxyPort ?? 1080
            args.push('-o', `ProxyCommand=nc -X 5 -x ${options.socksProxyHost}:${proxyPort} %h %p`)
        }

        // HTTP proxy
        if (options.httpProxyHost) {
            const proxyPort = options.httpProxyPort ?? 8080
            args.push('-o', `ProxyCommand=nc -X connect -x ${options.httpProxyHost}:${proxyPort} %h %p`)
        }

        // Skip banner/MoTD
        if (options.skipBanner) {
            args.push('-o', 'LogLevel=ERROR')
        }

        // Connection timeout
        if (options.readyTimeout) {
            args.push('-o', `ConnectTimeout=${Math.floor(options.readyTimeout / 1000)}`)
        }

        // Disable strict host key checking if configured
        if (!this.config.store.ssh.verifyHostKeys) {
            args.push('-o', 'StrictHostKeyChecking=no')
            args.push('-o', 'UserKnownHostsFile=/dev/null')
        }

        // User and host
        const userHost = options.user ? `${options.user}@${options.host}` : options.host
        args.push(userHost)

        return args
    }

    private emitServiceMessage (message: string): void {
        this.serviceMessage.next(message)
    }

    protected emitOutput (data: Buffer): void {
        this.output.next(data.toString())
    }

    resize (columns: number, rows: number): void {
        if (this.pty) {
            this.pty.resize(columns, rows).catch(err => {
                this.logger.error('Failed to resize PTY:', err)
            })
        }
    }

    write (data: Buffer): void {
        if (this.pty && !this.ptyClosed) {
            this.pty.write(data).catch(err => {
                this.logger.error('Failed to write to PTY:', err)
            })
        }
    }

    kill (signal?: string): void {
        if (this.pty) {
            this.pty.kill(signal).catch(err => {
                this.logger.error('Failed to kill PTY:', err)
            })
        }
    }

    async gracefullyKillProcess (): Promise<void> {
        if (this.pty) {
            try {
                await this.pty.kill('SIGTERM')
                // Give it a moment to terminate gracefully
                setTimeout(async () => {
                    if (!this.ptyClosed && this.pty) {
                        await this.pty.kill('SIGKILL')
                    }
                }, 5000)
            } catch (err) {
                this.logger.error('Failed to kill process gracefully:', err)
            }
        }
    }

    supportsWorkingDirectory (): boolean {
        return false // SSH sessions don't support working directory detection easily
    }

    async getWorkingDirectory (): Promise<string|null> {
        return null
    }

    async destroy (): Promise<void> {
        this.logger.debug('Destroying system SSH session')

        if (this.pty && !this.ptyClosed) {
            try {
                await this.pty.kill()
                this.pty.unsubscribeAll()
            } catch (err) {
                this.logger.error('Error destroying PTY:', err)
            }
        }

        this.serviceMessage.complete()
        await super.destroy()
    }
}
