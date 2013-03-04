/* ========================================================================================================
 * prefs.js - preferences
 * ========================================================================================================
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;


const GnoMenuPreferencesWidget = new GObject.Class({
    Name: 'GnoMenu.GnoMenuPreferencesWidget',
    GTypeName: 'GnoMenuPreferencesWidget',
    Extends: Gtk.Box,

    _init: function(params) {
        this.parent(params);
        this.settings = Convenience.getSettings('org.gnome.shell.extensions.gnomenu');

        let frame = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL
        });

        /* PANEL SETTINGS */

        let panelSettings = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_bottom: 10
        });

        let panelSettingsTitle = new Gtk.Label({
            label: "<b>Top Panel Settings</b>",
            use_markup: true,
            xalign: 0,
            margin_top: 5,
            margin_bottom: 5
        });

        let hidePanelViewBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: true,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 0,
            margin_right: 10
        });
        let hidePanelViewLabel = new Gtk.Label({
            label: "Remove View button from panel",
            use_markup: true,
            xalign: 0,
            hexpand: true
        });
        let hidePanelViewSwitch = new Gtk.Switch ({
            halign: Gtk.Align.END
        });
        hidePanelViewSwitch.set_active(this.settings.get_boolean('hide-panel-view'));
        hidePanelViewSwitch.connect("notify::active", Lang.bind(this, function(check) {
            this.settings.set_boolean('hide-panel-view', check.get_active());
        }));

        hidePanelViewBox.add(hidePanelViewLabel);
        hidePanelViewBox.add(hidePanelViewSwitch);


        let disableHotCornerBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: true,
            margin_left: 20,
            margin_top: 0,
            margin_bottom: 5,
            margin_right: 10
        });
        let disableHotCorner = new Gtk.CheckButton({
            label: _("Disable Hot Corner"),
            margin_left: 20
        });
        disableHotCorner.set_active(this.settings.get_boolean('disable-panel-view-hotcorner'));
        disableHotCorner.connect('toggled', Lang.bind(this, function(check) {
            this.settings.set_boolean('disable-panel-view-hotcorner', check.get_active());
        }));

        this.settings.bind('hide-panel-view', disableHotCornerBox, 'sensitive', Gio.SettingsBindFlags.INVERT_BOOLEAN);
        disableHotCornerBox.add(disableHotCorner);


        let hidePanelAppsBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: true,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let hidePanelAppsLabel = new Gtk.Label({
            label: "Remove Apps button from panel",
            use_markup: true,
            xalign: 0,
            hexpand: true
        });
        let hidePanelAppsSwitch = new Gtk.Switch ({
            halign: Gtk.Align.END
        });
        hidePanelAppsSwitch.set_active(this.settings.get_boolean('hide-panel-apps'));
        hidePanelAppsSwitch.connect("notify::active", Lang.bind(this, function(check) {
            this.settings.set_boolean('hide-panel-apps', check.get_active());
        }));

        hidePanelAppsBox.add(hidePanelAppsLabel);
        hidePanelAppsBox.add(hidePanelAppsSwitch);


        let hidePanelMenuBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: true,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 0,
            margin_right: 10
        });
        let hidePanelMenuLabel = new Gtk.Label({
            label: "Remove Menu button from panel",
            use_markup: true,
            xalign: 0,
            hexpand: true
        });
        let hidePanelMenuSwitch = new Gtk.Switch ({
            halign: Gtk.Align.END
        });
        hidePanelMenuSwitch.set_active(this.settings.get_boolean('hide-panel-menu'));
        hidePanelMenuSwitch.connect("notify::active", Lang.bind(this, function(check) {
            this.settings.set_boolean('hide-panel-menu', check.get_active());
        }));

        hidePanelMenuBox.add(hidePanelMenuLabel);
        hidePanelMenuBox.add(hidePanelMenuSwitch);


        let disableMenuHotSpotBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: true,
            margin_left: 20,
            margin_top: 0,
            margin_bottom: 5,
            margin_right: 10
        });
        let disableMenuHotSpot = new Gtk.CheckButton({
            label: _("Disable Menu button hot area"),
            margin_left: 20
        });
        disableMenuHotSpot.set_active(this.settings.get_boolean('disable-panel-menu-hotspot'));
        disableMenuHotSpot.connect('toggled', Lang.bind(this, function(check) {
            this.settings.set_boolean('disable-panel-menu-hotspot', check.get_active());
        }));

        this.settings.bind('hide-panel-menu', disableMenuHotSpotBox, 'sensitive', Gio.SettingsBindFlags.INVERT_BOOLEAN);
        disableMenuHotSpotBox.add(disableMenuHotSpot);


        panelSettings.add(panelSettingsTitle);
        panelSettings.add(hidePanelViewBox);
        panelSettings.add(disableHotCornerBox);
        panelSettings.add(hidePanelAppsBox);
        panelSettings.add(hidePanelMenuBox);
        panelSettings.add(disableMenuHotSpotBox);


        /* FAVORITES SETTINGS */
        

        /* APPS DISPLAY SETTINGS */

        let appsSettings = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_bottom: 50
        });

        let appsSettingsTitle = new Gtk.Label({
            label: "<b>Menu Settings</b>",
            use_markup: true,
            xalign: 0,
            margin_top: 5,
            margin_bottom: 5
        });

        let startupAppsDisplayBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: true,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let startupAppsDisplayLabel = new Gtk.Label({label: _("Startup applications to display"), hexpand:true, xalign:0});
        let startupAppsDisplayCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            startupAppsDisplayCombo.set_size_request(180, -1);
            startupAppsDisplayCombo.append_text(_('All'));
            startupAppsDisplayCombo.append_text(_('Favorites'));
            //startupAppsDisplayCombo.append_text(_('Places'));
            //startupAppsDisplayCombo.append_text(_('Recent'));
            startupAppsDisplayCombo.set_active(this.settings.get_enum('startup-apps-display'));
            startupAppsDisplayCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_enum('startup-apps-display', widget.get_active());
            }));

        startupAppsDisplayBox.add(startupAppsDisplayLabel);
        startupAppsDisplayBox.add(startupAppsDisplayCombo);

        let startupViewModeBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: true,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let startupViewModeLabel = new Gtk.Label({label: _("Default applications view mode"), hexpand:true, xalign:0});
        let startupViewModeCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            startupViewModeCombo.set_size_request(120, -1);
            startupViewModeCombo.append_text(_('List'));
            startupViewModeCombo.append_text(_('Grid'));
            startupViewModeCombo.set_active(this.settings.get_enum('startup-view-mode'));
            startupViewModeCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_enum('startup-view-mode', widget.get_active());
            }));

        startupViewModeBox.add(startupViewModeLabel);
        startupViewModeBox.add(startupViewModeCombo);

        let categorySelectMethodBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: true,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let categorySelectMethodLabel = new Gtk.Label({label: _("Category selection method"), hexpand:true, xalign:0});
        let categorySelectMethodCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            categorySelectMethodCombo.set_size_request(120, -1);
            categorySelectMethodCombo.append_text(_('Hover'));
            categorySelectMethodCombo.append_text(_('Click'));
            categorySelectMethodCombo.set_active(this.settings.get_enum('category-selection-method'));
            categorySelectMethodCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_enum('category-selection-method', widget.get_active());
            }));

        categorySelectMethodBox.add(categorySelectMethodLabel);
        categorySelectMethodBox.add(categorySelectMethodCombo);

        let iconSizes = [16, 20, 24, 28, 32, 48, 64];
        
        let appsListIconSizeBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: true,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let appsListIconSizeLabel = new Gtk.Label({label: _("Size of Application List icons"), hexpand:true, xalign:0});
        let appsListIconSizeCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            appsListIconSizeCombo.set_size_request(120, -1);
            appsListIconSizeCombo.append_text('16');
            appsListIconSizeCombo.append_text('20');
            appsListIconSizeCombo.append_text('24');
            appsListIconSizeCombo.append_text('28');
            appsListIconSizeCombo.append_text('32');
            appsListIconSizeCombo.append_text('48');
            appsListIconSizeCombo.append_text('64');
            appsListIconSizeCombo.set_active(iconSizes.indexOf(this.settings.get_int('apps-list-icon-size')));
            appsListIconSizeCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_int('apps-list-icon-size', iconSizes[widget.get_active()]);
            }));

        appsListIconSizeBox.add(appsListIconSizeLabel);
        appsListIconSizeBox.add(appsListIconSizeCombo);

        let appsGridIconSizeBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: true,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let appsGridIconSizeLabel = new Gtk.Label({label: _("Size of Application Grid icons"), hexpand:true, xalign:0});
        let appsGridIconSizeCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            appsGridIconSizeCombo.set_size_request(120, -1);
            appsGridIconSizeCombo.append_text('16');
            appsGridIconSizeCombo.append_text('20');
            appsGridIconSizeCombo.append_text('24');
            appsGridIconSizeCombo.append_text('28');
            appsGridIconSizeCombo.append_text('32');
            appsGridIconSizeCombo.append_text('48');
            appsGridIconSizeCombo.append_text('64');
            appsGridIconSizeCombo.set_active(iconSizes.indexOf(this.settings.get_int('apps-grid-icon-size')));
            appsGridIconSizeCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_int('apps-grid-icon-size', iconSizes[widget.get_active()]);
            }));

        appsGridIconSizeBox.add(appsGridIconSizeLabel);
        appsGridIconSizeBox.add(appsGridIconSizeCombo);
        
        appsSettings.add(appsSettingsTitle);
        appsSettings.add(startupAppsDisplayBox);
        appsSettings.add(startupViewModeBox);
        appsSettings.add(categorySelectMethodBox);
        appsSettings.add(appsListIconSizeBox);
        appsSettings.add(appsGridIconSizeBox);

        
        frame.add(panelSettings);
        frame.add(appsSettings);


        this.add(frame);

    }
});

function init() {
    Convenience.initTranslations();
}

function buildPrefsWidget() {
    let widget = new GnoMenuPreferencesWidget({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 5,
        border_width: 5
    });
    widget.show_all();

    return widget;
}

