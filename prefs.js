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

const {Adw, Gio} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;

const _ = ExtensionUtils.gettext;

/**
 * Like `extension.js` this is used for any one-time setup like translations.
 *
 * @param {ExtensionMeta} meta - An extension meta object
 */
function init(meta) {
    ExtensionUtils.initTranslations(meta.uuid);
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

    // Create a preferences page, with a single group
    const page = new Adw.PreferencesPage();
    window.add(page);

    const group = new Adw.PreferencesGroup({
        title: _('KMonad configuration'),
        description: _(
            'This extension does not manage the KMonad installation.' +
        ' See the <a href="https://github.com/kmonad/kmonad/blob/master/doc/installation.md">Installation guide</a>' +
        ' and <a href="https://github.com/kmonad/kmonad/blob/master/doc/faq.md">FAQ</a>' +
        ' for instructions on how to set it up.' +
        '\n\n' +
        'Note: shell expansion is not supported, so please use absolute paths.'
        ),
    });
    page.add(group);

    // Create a new preferences row
    const row = new Adw.EntryRow({
        title: _('Custom command'),
        text: settings.get_string('kmonad-command'),
    });
    group.add(row);

    settings.bind('kmonad-command', row, 'text', Gio.SettingsBindFlags.DEFAULT);

    // Make sure the window doesn't outlive the settings object
    window._settings = settings;
}
