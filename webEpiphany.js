/* ========================================================================================================
 *  CREDITS:  Code borrowed from SearchBookmarks extension by bmh1980
 *            at https://extensions.gnome.org/extension/557/search-bookmarks/
 * ========================================================================================================
 */

/**
 * Copyright (C) 2012 Marcus Habermehl <bmh1980de@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301,
 * USA.
*/

// External imports
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Shell = imports.gi.Shell;

// Gjs imports
const Lang = imports.lang;

// Internal imports
const Main = imports.ui.main;

const _appSystem = Shell.AppSystem.get_default();
//const _foundApps = _appSystem.initial_search(['epiphany']);
const _foundApps = _appSystem.lookup_desktop_wmclass('epiphany');


var _appInfo = null;
var _bookmarksFile = null;
var _bookmarksMonitor = null;
var _callbackId = null;
var bookmarks = [];

function _readBookmarks() {
    bookmarks = [];

    let content;
    let size;
    let success;

    try {
        [success, content, size] = _bookmarksFile.load_contents(null);
    } catch(e) {
        log("ERROR: " + e.message);
        return;
    }

    if (! success) {
        return;
    }

    content = String(content);
    content = content.replace(/^<\?xml version=["'][0-9\.]+["']\?>/, '');

    default xml namespace = 'http://purl.org/rss/1.0/';
    let xmlData = new XML(content);
    let xmlItems = xmlData.item;

    for (let i in xmlItems) {
        let xmlItem = xmlItems[i];

        bookmarks.push({
            appInfo: _appInfo,
            name: String(xmlItem.title),
            score: 0,
            uri: String(xmlItem.link)
        });
    }
}

function _reset() {
    _appInfo = null;
    _bookmarksFile = null;
    _bookmarksMonitor = null;
    _callbackId = null;
    bookmarks = [];
}

function init() {
    if (_foundApps == null || _foundApps.length == 0) {
        return;
    }

    // _appInfo = _foundApps[0].get_app_info();
    _appInfo = _foundApps.get_app_info();

    _bookmarksFile = Gio.File.new_for_path(GLib.build_filenamev(
        [GLib.get_user_config_dir(), 'epiphany', 'bookmarks.rdf']));

    if (! _bookmarksFile.query_exists(null)) {
        _reset();
        return;
    }

    _bookmarksMonitor = _bookmarksFile.monitor_file(
        Gio.FileMonitorFlags.NONE, null);
    _callbackId = _bookmarksMonitor.connect(
        'changed', Lang.bind(this, _readBookmarks));

    _readBookmarks();
}

function deinit() {
    if (_bookmarksMonitor) {
        if (_callbackId) {
            _bookmarksMonitor.disconnect(_callbackId);
        }

        _bookmarksMonitor.cancel();
    }

    _reset();
}
