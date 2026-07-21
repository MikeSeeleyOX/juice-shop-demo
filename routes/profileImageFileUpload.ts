/*
 * Copyright (c) 2014-2023 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import fs = require('fs')
import path = require('path')
import { Request, Response, NextFunction } from 'express'
import { UserModel } from '../models/user'

const utils = require('../lib/utils')
const security = require('../lib/insecurity')
const logger = require('../lib/logger')
const fileType = require('file-type')

module.exports = function fileUpload () {
  return async (req: Request, res: Response, next: NextFunction) => {
    const file = req.file
    const buffer = file?.buffer
    const uploadedFileType = await fileType.fromBuffer(buffer)

    if (uploadedFileType === undefined) {
      res.status(500)
      next(new Error('Illegal file type'))
    } else {
      if (uploadedFileType !== null && utils.startsWith(uploadedFileType.mime, 'image')) {
        const loggedInUser = security.authenticatedUsers.get(req.cookies.token)
        if (loggedInUser) {
          const safeUserId = path.basename(loggedInUser.data.id)
          const safeExt = path.basename(uploadedFileType.ext)
          const uploadDir = path.join('frontend', 'dist', 'frontend', 'assets', 'public', 'images', 'uploads')
          const filePath = path.join(uploadDir, `${safeUserId}.${safeExt}`)
          fs.open(filePath, 'w', function (err, fd) {
            if (err != null) logger.warn('Error opening file: ' + err.message)
            // @ts-expect-error
            fs.write(fd, buffer, 0, buffer.length, null, function (err) {
              if (err != null) logger.warn('Error writing file: ' + err.message)
              fs.close(fd, function () { })
            })
          })
          UserModel.findByPk(loggedInUser.data.id).then(async (user: UserModel | null) => {
            if (user) {
              return await user.update({ profileImage: path.join('assets', 'public', 'images', 'uploads', `${safeUserId}.${safeExt}`) })
            }
          }).catch((error: Error) => {
            next(error)
          })
          res.location(process.env.BASE_PATH + '/profile')
          res.redirect(process.env.BASE_PATH + '/profile')
        } else {
          next(new Error('Blocked illegal activity by ' + req.socket.remoteAddress))
        }
      } else {
        res.status(415)
        next(new Error(`Profile image upload does not accept this file type${uploadedFileType ? (': ' + uploadedFileType.mime) : '.'}`))
      }
    }
  }
}