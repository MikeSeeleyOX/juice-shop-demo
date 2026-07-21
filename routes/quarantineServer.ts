/*
 * Copyright (c) 2014-2023 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import path = require('path')
import { Request, Response, NextFunction } from 'express'

module.exports = function serveQuarantineFiles () {
  return ({ params, query }: Request, res: Response, next: NextFunction) => {
    const file = params.file
    const sanitizedFile = path.basename(file)

    if (!file.includes('/')) {
      res.sendFile(path.resolve(path.join('ftp', 'quarantine', sanitizedFile)))
    } else {
      res.status(403)
      next(new Error('File names cannot contain forward slashes!'))
    }
  }
}