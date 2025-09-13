/**
 * Network utilities for HTTP requests
 */

import https from 'node:https'
import http from 'node:http'
import { URL } from 'node:url'

export interface GitHubRelease {
  tag_name: string
  assets: GitHubAsset[]
}

export interface GitHubAsset {
  name: string
  browser_download_url: string
  size: number
}

export interface DownloadOptions {
  onProgress?: (downloaded: number, total: number) => void
  timeout?: number
  skipTLS?: boolean
}

export class NetworkUtils {
  /**
   * Fetch JSON data from a URL
   */
  static async fetchJson<T = any>(url: string, options?: DownloadOptions): Promise<T> {
    const response = await this.fetch(url, options)
    return JSON.parse(response)
  }

  /**
   * Fetch text content from a URL
   */
  static async fetch(url: string, options?: DownloadOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url)
      const isHttps = parsedUrl.protocol === 'https:'

      const requestOptions: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'spec-kit-cli/2.0.0',
          'Accept': 'application/json',
        },
        timeout: options?.timeout || 30000,
      }

      if (options?.skipTLS && isHttps) {
        requestOptions.rejectUnauthorized = false
      }

      const protocol = isHttps ? https : http
      const req = protocol.request(requestOptions, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          // Handle redirects
          const redirectUrl = res.headers.location
          if (redirectUrl) {
            this.fetch(redirectUrl, options).then(resolve).catch(reject)
            return
          }
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
          return
        }

        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          resolve(data)
        })
      })

      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })

      req.end()
    })
  }

  /**
   * Download a file from a URL
   */
  static async downloadFile(
    url: string,
    destPath: string,
    options?: DownloadOptions
  ): Promise<void> {
    const fs = await import('node:fs')

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url)
      const isHttps = parsedUrl.protocol === 'https:'

      const requestOptions: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'spec-kit-cli/2.0.0',
        },
        timeout: options?.timeout || 60000,
      }

      if (options?.skipTLS && isHttps) {
        requestOptions.rejectUnauthorized = false
      }

      const file = fs.createWriteStream(destPath)
      const protocol = isHttps ? https : http

      const req = protocol.request(requestOptions, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          // Handle redirects
          const redirectUrl = res.headers.location
          if (redirectUrl) {
            file.close()
            fs.unlinkSync(destPath)
            this.downloadFile(redirectUrl, destPath, options).then(resolve).catch(reject)
            return
          }
        }

        if (res.statusCode !== 200) {
          file.close()
          fs.unlinkSync(destPath)
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
          return
        }

        const totalSize = parseInt(res.headers['content-length'] || '0', 10)
        let downloaded = 0

        if (options?.onProgress && totalSize > 0) {
          res.on('data', (chunk) => {
            downloaded += chunk.length
            options.onProgress!(downloaded, totalSize)
          })
        }

        res.pipe(file)

        file.on('finish', () => {
          file.close(() => resolve())
        })
      })

      req.on('error', (err) => {
        file.close()
        fs.unlinkSync(destPath)
        reject(err)
      })

      req.on('timeout', () => {
        req.destroy()
        file.close()
        fs.unlinkSync(destPath)
        reject(new Error('Download timeout'))
      })

      req.end()
    })
  }

  /**
   * Get the latest GitHub release for a repository
   */
  static async getLatestGitHubRelease(
    owner: string,
    repo: string,
    options?: DownloadOptions
  ): Promise<GitHubRelease> {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`
    return await this.fetchJson<GitHubRelease>(url, options)
  }

  /**
   * Find a specific asset in a GitHub release
   */
  static findReleaseAsset(
    release: GitHubRelease,
    pattern: string
  ): GitHubAsset | undefined {
    return release.assets.find(asset =>
      asset.name.includes(pattern) && asset.name.endsWith('.zip')
    )
  }
}