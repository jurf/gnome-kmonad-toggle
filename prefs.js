/* prefs.js
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

/* exported init, fillPreferencesWindow */

'use strict';

const {Adw, Gio, Gtk} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;

const _ = ExtensionUtils.gettext;

/**
 * Like `extension.js` this is used for any one-time setup like translations.
 */
function init() {
    ExtensionUtils.initTranslations();
}

/**
 * This function is called when the preferences window is first created to fill
 * the `Adw.PreferencesWindow`.
 *
 * This function will only be called by GNOME 42 and later. If this function is
 * present, `buildPrefsWidget()` will NOT be called.
 *
 * @param {Adw.PreferencesWindow} window - The preferences window
 */
function fillPreferencesWindow(window) {
    const settings = ExtensionUtils.getSettings();

    const page = new Adw.PreferencesPage();
    window.add(page);

    const group = new Adw.PreferencesGroup({
        description: _(
            'This extension does not manage the KMonad installation.' +
            ' See the <a href="https://github.com/kmonad/kmonad/blob/master/doc/installation.md">Installation guide</a>' +
            ' and <a href="https://github.com/kmonad/kmonad/blob/master/doc/faq.md">FAQ</a>' +
            ' for instructions on how to set it up.'
        ),
    });
    page.add(group);

    group.add(createSettingsToggle(settings, 'kmonad-running', 'Start KMonad now'));
    group.add(createSettingsToggle(settings, 'autostart-kmonad', 'Autostart KMonad'));

    const kmonadGroup = new Adw.PreferencesGroup({
        title: _('KMonad configuration'),
        description: _(
            'Shell expansion is not supported, so please use absolute paths.'
        ),
    });
    page.add(kmonadGroup);

    kmonadGroup.add(createSettingsEntry(settings, 'kmonad-command', 'Custom command'));

    // Make sure the window doesn't outlive the settings object
    window._settings = settings;
}

/**
 * Creates an Adw.ActionRow with a Gtk.Switch and binds it to a boolean key in
 * the settings object.
 *
 * @param {Gio.Settings} settings - The settings object
 * @param {string} key - The key to bind to
 * @param {string} title - The title of the row
 * @returns {Adw.ActionRow} The row
 */
function createSettingsToggle(settings, key, title) {
    const row = new Adw.ActionRow({title: _(title)});

    const toggle = new Gtk.Switch({
        active: settings.get_boolean(key),
        valign: Gtk.Align.CENTER,
    });
    settings.bind(key, toggle, 'active',
        Gio.SettingsBindFlags.DEFAULT);
    row.add_suffix(toggle);
    row.activatable_widget = toggle;

    return row;
}

/**
 * Creates an Adw.EntryRow and binds it to a string key in the settings object.
 *
 * @param {Gio.Settings} settings - The settings object
 * @param {string} key - The key to bind to
 * @param {string} title - The title of the row
 * @returns {Adw.EntryRow} The row
 */
function createSettingsEntry(settings, key, title) {
    const row = new Adw.EntryRow({
        title: _(title),
        text: settings.get_string(key),
    });
    settings.bind(key, row, 'text', Gio.SettingsBindFlags.DEFAULT);

    return row;
}
