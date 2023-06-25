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

const {Gio, GLib, GObject} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const QuickSettings = imports.ui.quickSettings;

const _ = ExtensionUtils.gettext;

// This is the live instance of the Quick Settings menu
const QuickSettingsMenu = imports.ui.main.panel.statusArea.quickSettings;

let loop = GLib.MainLoop.new(null, false);


const KMonadToggle = GObject.registerClass(
  class FeatureToggle extends QuickSettings.QuickToggle {
      _init() {
          super._init({
              title: _('KMonad'),
              gicon: getIcon(),
              toggleMode: true,
          });

          // NOTE: In GNOME 44, the `label` property must be set after
          // construction. The newer `title` property can be set at construction.
          this.label = _('KMonad');

          this._settings = ExtensionUtils.getSettings();

          this._settings.bind(
              'enable-kmonad',
              this,
              'checked',
              Gio.SettingsBindFlags.DEFAULT
          );
      }
  }
);

const KMonadIndicator = GObject.registerClass(
  class FeatureIndicator extends QuickSettings.SystemIndicator {
      _init() {
          super._init();

          // Create the icon for the indicator
          this._indicator = this._addIndicator();
          this._indicator.gicon = getIcon();

          // Showing the indicator when the feature is enabled
          this._settings = ExtensionUtils.getSettings();

          this._settings.bind(
              'enable-kmonad',
              this._indicator,
              'visible',
              Gio.SettingsBindFlags.DEFAULT
          );

          // Create the toggle and associate it with the indicator, being sure to
          // destroy it along with the indicator
          this.quickSettingsItems.push(new KMonadToggle());

          this.connect('destroy', () => {
              this.quickSettingsItems.forEach(item => item.destroy());
          });

          // Add the indicator to the panel and the toggle to the menu
          QuickSettingsMenu._indicators.add_child(this);
          addQuickSettingsItems(this.quickSettingsItems);
      }
  }
);

/**
 * Returns the KMonad symbolic icon
 */
function getIcon() {
    return Gio.icon_new_for_string(
        GLib.build_filenamev([Me.path, 'icons', 'kmonad-symbolic.svg'])
    );
}

/**
 * Adds the items to the Quick Settings menu above the Background Apps menu
 *
 * @param {Array} items - The items to add
 */
function addQuickSettingsItems(items) {
    // Add the items with the built-in function
    QuickSettingsMenu._addItems(items);

    // Ensure the tile(s) are above the background apps menu
    for (const item of items) {
        QuickSettingsMenu.menu._grid.set_child_below_sibling(
            item,
            QuickSettingsMenu._backgroundApps.quickSettingsItems[0]
        );
    }
}

class Extension {
    constructor(uuid) {
        this._uuid = uuid;

        this._indicator = null;

        this._settings = ExtensionUtils.getSettings();
        this._kmonad_process = null;

        // Watch for changes to a specific setting
        this._settings.connect('changed::enable-kmonad', (settings, key) => {
            const isEnabled = settings.get_boolean(key);
            if (isEnabled)
                this.startKmonad();
            else
                this.stopKmonad();
        });
    }

    /**
     * This function is called when your extension is enabled, which could be
     * done in GNOME Extensions, when you log in or when the screen is unlocked.
     *
     * This is when you should setup any UI for your extension, change existing
     * widgets, connect signals or modify GNOME Shell's behaviour.
     */
    enable() {
        this._indicator = new KMonadIndicator();
        // TODO: Does this need to be set to false first?
        this._settings.set_boolean('enable-kmonad', false);
        this._settings.set_boolean('enable-kmonad', true);
    }

    /**
     * This function is called when your extension is uninstalled, disabled in
     * GNOME Extensions, when you log out or when the screen locks.
     *
     * Anything you created, modified or setup in enable() MUST be undone here.
     * Not doing so is the most common reason extensions are rejected in review!
     */
    disable() {
        this._indicator.destroy();
        this._indicator = null;
        this._settings.set_boolean('enable-kmonad', false);
    }

    /**
     * Starts the kmonad process
     */
    startKmonad() {
        if (this._kmonad_process) {
            console.warn('Kmonad already running; restarting');
            this.stopKmonad();
        }
        try {
            const command = GLib.shell_parse_argv(
                this._settings.get_string('kmonad-command')
            )[1];
            this._kmonad_process = Gio.Subprocess.new(
                command,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            this._kmonad_process.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(res);

                    if (proc.get_successful())
                        log(stdout);
                    else
                        throw new Error(stderr);
                } catch (e) {
                    logError(e);
                } finally {
                    loop.quit();
                    this._kmonad_process = null;
                    this._settings.set_boolean('enable-kmonad', false);
                }
            });
        } catch (e) {
            logError(e);
        }
    }

    /**
     * Starts the kmonad process
     */
    stopKmonad() {
        if (this._kmonad_process) {
            try {
                this._kmonad_process.force_exit();
            } catch (e) {
                logError(e);
            }
            this._kmonad_process = null;
        }
    }
}

/**
 * This function is called once when your extension is loaded, not enabled. This
 * is a good time to setup translations or anything else you only do once.
 *
 * You MUST NOT make any changes to GNOME Shell, connect any signals or add any
 * MainLoop sources here.
 *
 * @param {ExtensionMeta} meta - An extension meta object, described below.
 * @returns {object} an object with enable() and disable() methods
 */
function init(meta) {
    ExtensionUtils.initTranslations(meta.uuid);

    return new Extension(meta.uuid);
}
