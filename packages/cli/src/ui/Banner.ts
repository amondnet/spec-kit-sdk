/**
 * Banner display utilities
 */

import pc from 'picocolors'
import { consoleUtils } from './Console.js'

export const BANNER = `
███████╗██████╗ ███████╗ ██████╗██╗███████╗██╗   ██╗
██╔════╝██╔══██╗██╔════╝██╔════╝██║██╔════╝╚██╗ ██╔╝
███████╗██████╔╝█████╗  ██║     ██║█████╗   ╚████╔╝
╚════██║██╔═══╝ ██╔══╝  ██║     ██║██╔══╝    ╚██╔╝
███████║██║     ███████╗╚██████╗██║██║        ██║
╚══════╝╚═╝     ╚══════╝ ╚═════╝╚═╝╚═╝        ╚═╝
`

export const MINI_BANNER = `
╔═╗╔═╗╔═╗╔═╗╦╔═╗╦ ╦
╚═╗╠═╝║╣ ║  ║╠╣ ╚╦╝
╚═╝╩  ╚═╝╚═╝╩╚   ╩
`

export const TAGLINE = 'Spec-Driven Development Toolkit'

export class Banner {
  static show(mini: boolean = false): void {
    if (mini) {
      this.showMini()
    } else {
      this.showFull()
    }
  }

  static showFull(): void {
    const bannerLines = BANNER.trim().split('\n')
    const colors = ['bright_blue', 'blue', 'cyan', 'bright_cyan', 'white', 'bright_white'] as const

    // Create gradient effect
    bannerLines.forEach((line, i) => {
      const colorName = colors[i % colors.length]
      const colorFn = colorName === 'bright_blue' ? pc.blueBright
        : colorName === 'blue' ? pc.blue
        : colorName === 'cyan' ? pc.cyan
        : colorName === 'bright_cyan' ? pc.cyanBright
        : colorName === 'white' ? pc.white
        : pc.whiteBright

      consoleUtils.center(colorFn(line))
    })

    consoleUtils.center(pc.italic(pc.yellowBright(TAGLINE)))
    consoleUtils.log()
  }

  static showMini(): void {
    const lines = MINI_BANNER.trim().split('\n')
    lines.forEach(line => {
      consoleUtils.center(pc.cyan(line))
    })
    consoleUtils.center(pc.dim(TAGLINE))
    consoleUtils.log()
  }
}