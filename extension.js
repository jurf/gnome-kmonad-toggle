/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

'use strict';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';


import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';


const KMonadToggle = GObject.registerClass(
class FeatureToggle extends QuickSettings.QuickToggle {
    _init(extensionObject, icon) {
        super._init({
            title: _('KMonad'),
            gicon: icon,
            toggleMode: true,
        });

        this._settings = extensionObject.getSettings();
        this._settings.bind(
            'kmonad-running',
            this,
            'checked',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
}
);

const KMonadIndicator = GObject.registerClass(
class FeatureIndicator extends QuickSettings.SystemIndicator {
    _init(extensionObject, icon) {
        super._init();

        // Create the icon for the indicator
        this._indicator = this._addIndicator();
        this._indicator.gicon = icon;

        // Showing the indicator when the feature is enabled
        this._settings = extensionObject.getSettings();
        this._settings.bind(
            'kmonad-running',
            this._indicator,
            'visible',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
}
);

export default class KMonadToggleExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        // Watch for changes to a specific setting
        this._handlerId = this._settings.connect('changed::kmonad-running', async (settings, key) => {
            const isEnabled = settings.get_boolean(key);
            if (isEnabled) {
                this._cancellable = new Gio.Cancellable();
                await this.startKmonad();
            } else if (this._cancellable) {
                this._cancellable.cancel();
                this._cancellable = null;
            }
        });

        this._indicator = new KMonadIndicator(this, this.getIcon());
        this._indicator.quickSettingsItems.push(new KMonadToggle(this, this.getIcon()));
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);

        this._settings.set_boolean('kmonad-running', false);
        if (this._settings.get_boolean('autostart-kmonad'))
            this._settings.set_boolean('kmonad-running', true);
    }

    disable() {
        if (this._indicator) {
            this._indicator.quickSettingsItems.forEach(item => item.destroy());
            this._indicator.destroy();
            this._indicator = null;
        }
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
        if (this._handlerId) {
            this._settings.disconnect(this._handlerId);
            this._handlerId = null;
        }
    }

    /**
     * Starts the kmonad process
     */
    async startKmonad() {
        const command = GLib.shell_parse_argv(
            this._settings.get_string('kmonad-command')
        )[1];
        try {
            await execCommunicate(command, null, this._cancellable);
        } catch (e) {
            if (this._cancellable?.is_cancelled() === false)
                Main.notifyError(_('KMonad failed'), e.message.trim());
        } finally {
            this._settings.set_boolean('kmonad-running', false);
        }
    }

    getIcon() {
        return Gio.icon_new_for_string(
            GLib.build_filenamev([this.path, 'icons', 'kmonad-symbolic.svg'])
        );
    }
}

/**
 * Execute a command asynchronously and return the output from `stdout` on
 * success or throw an error with output from `stderr` on failure.
 *
 * If given, @input will be passed to `stdin` and @cancellable can be used to
 * stop the process before it finishes.
 *
 * @param {string[]} argv - a list of string arguments
 * @param {string} [input] - Input to write to `stdin` or %null to ignore
 * @param {Gio.Cancellable} [cancellable] - optional cancellable object
 * @returns {Promise<string>} - The process output
 */
function execCommunicate(argv, input = null, cancellable = null) {
    let cancelId = 0;
    let flags = Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE;

    if (input !== null)
        flags |= Gio.SubprocessFlags.STDIN_PIPE;

    let proc = new Gio.Subprocess({
        argv,
        flags,
    });
    proc.init(cancellable);

    if (cancellable instanceof Gio.Cancellable)
        cancelId = cancellable.connect(() => proc.force_exit());


    return new Promise((resolve, reject) => {
        proc.communicate_utf8_async(input, null, (proc_, res) => {
            try {
                let [, stdout, stderr] = proc_.communicate_utf8_finish(res);
                let status = proc_.get_exit_status();

                if (status !== 0) {
                    throw new Gio.IOErrorEnum({
                        code: Gio.io_error_from_errno(status),
                        message: stderr ? stderr.trim() : GLib.strerror(status),
                    });
                }

                resolve(stdout.trim());
            } catch (e) {
                reject(e);
            } finally {
                if (cancelId > 0)
                    cancellable.disconnect(cancelId);
            }
        });
    });
}
