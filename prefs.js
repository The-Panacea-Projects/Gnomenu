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

        let notebook = new Gtk.Notebook();

        let notebookPanelButtons = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_left: 10,
            margin_right: 10,
            margin_bottom: 20
        });
        let notebookPanelButtonsTitle = new Gtk.Label({
            label: _("Panel Buttons"),
            use_markup: true,
            xalign: 0
        });

        let notebookMenuPanels = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_left: 10,
            margin_right: 10,
            margin_bottom: 20
        });
        let notebookMenuPanelsTitle = new Gtk.Label({
            label: _("Menu Layout"),
            use_markup: true,
            xalign: 0
        });

        let notebookAppsGrid = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_left: 10,
            margin_right: 10,
            margin_bottom: 20
        });
        let notebookAppsGridTitle = new Gtk.Label({
            label: _("Apps Grid-List"),
            use_markup: true,
            xalign: 0
        });

        let frame = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL
        });


        /* PANEL SETTINGS */

        let panelSettings = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 10,
            margin_bottom: 10
        });

        let panelSettingsTitle = new Gtk.Label({
            label: _("<b>Panel Settings</b>"),
            use_markup: true,
            xalign: 0,
            margin_top: 5,
            margin_bottom: 5
        });

        let disableHotCornerBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let disableHotCornerLabel = new Gtk.Label({
            label: _("Activities hot corner"),
            use_markup: true,
            xalign: 0,
            hexpand: true
        });
        let disableHotCornerSwitch = new Gtk.Switch ({
            halign: Gtk.Align.END
        });
        disableHotCornerSwitch.set_active(!this.settings.get_boolean('disable-activities-hotcorner'));
        disableHotCornerSwitch.connect("notify::active", Lang.bind(this, function(check) {
            this.settings.set_boolean('disable-activities-hotcorner', !check.get_active());
        }));

        disableHotCornerBox.add(disableHotCornerLabel);
        disableHotCornerBox.add(disableHotCornerSwitch);

        let hidePanelViewBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let hidePanelViewLabel = new Gtk.Label({
            label: _("View button"),
            use_markup: true,
            xalign: 0,
            hexpand: true
        });
        let hidePanelViewSwitch = new Gtk.Switch ({
            halign: Gtk.Align.END
        });
        hidePanelViewSwitch.set_active(!this.settings.get_boolean('hide-panel-view'));
        hidePanelViewSwitch.connect("notify::active", Lang.bind(this, function(check) {
            this.settings.set_boolean('hide-panel-view', !check.get_active());
        }));

        hidePanelViewBox.add(hidePanelViewLabel);
        hidePanelViewBox.add(hidePanelViewSwitch);

        let panelViewBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL
        });

        let customViewLabelBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 0,
            margin_bottom: 5,
            margin_right: 10
        });

        let customViewLabel = new Gtk.CheckButton({
            label: _("Use label with View button"),
            margin_left: 40,
            hexpand: true,
            halign: Gtk.Align.START
        });
        customViewLabel.set_active(this.settings.get_boolean('use-panel-view-label'));
        customViewLabel.connect('toggled', Lang.bind(this, function(check) {
            this.settings.set_boolean('use-panel-view-label', check.get_active());
        }));

        let customViewLabelEntry = new Gtk.Entry({
            halign: Gtk.Align.END
        });
        customViewLabelEntry.set_width_chars(15);
        customViewLabelEntry.set_size_request(200, -1);
        customViewLabelEntry.set_text(this.settings.get_strv('panel-view-label-text')[0]);
        customViewLabelEntry.connect('changed', Lang.bind(this, function(entry) {
            let iconName = entry.get_text();
            this.settings.set_strv('panel-view-label-text', [iconName]);
        }));

        customViewLabelBox.add(customViewLabel);
        customViewLabelBox.add(customViewLabelEntry);

        let customViewIconBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 0,
            margin_bottom: 5,
            margin_right: 10
        });
        let customViewIcon = new Gtk.CheckButton({
            label: _("Use icon with View button"),
            margin_left: 40,
            hexpand: true,
            halign: Gtk.Align.START
        });
        customViewIcon.set_active(this.settings.get_boolean('use-panel-view-icon'));
        customViewIcon.connect('toggled', Lang.bind(this, function(check) {
            this.settings.set_boolean('use-panel-view-icon', check.get_active());
        }));

        let customViewIconEntry = new Gtk.Entry({
            halign: Gtk.Align.END
        });
        customViewIconEntry.set_width_chars(15);
        customViewIconEntry.set_size_request(200, -1);
        customViewIconEntry.set_text(this.settings.get_strv('panel-view-icon-name')[0]);
        customViewIconEntry.connect('changed', Lang.bind(this, function(entry) {
            let iconName = entry.get_text();
            this.settings.set_strv('panel-view-icon-name', [iconName]);
        }));

        this.settings.bind('use-panel-view-icon', customViewIconEntry, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
        customViewIconBox.add(customViewIcon);
        customViewIconBox.add(customViewIconEntry);

        this.settings.bind('hide-panel-view', panelViewBox, 'sensitive', Gio.SettingsBindFlags.INVERT_BOOLEAN);
        panelViewBox.add(customViewLabelBox);
        panelViewBox.add(customViewIconBox);


        let hidePanelAppsBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let hidePanelAppsLabel = new Gtk.Label({
            label: _("Apps button"),
            use_markup: true,
            xalign: 0,
            hexpand: true
        });
        let hidePanelAppsSwitch = new Gtk.Switch ({
            halign: Gtk.Align.END
        });
        hidePanelAppsSwitch.set_active(!this.settings.get_boolean('hide-panel-apps'));
        hidePanelAppsSwitch.connect("notify::active", Lang.bind(this, function(check) {
            this.settings.set_boolean('hide-panel-apps', !check.get_active());
        }));

        hidePanelAppsBox.add(hidePanelAppsLabel);
        hidePanelAppsBox.add(hidePanelAppsSwitch);

        let panelAppsBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL
        });

        let customAppsLabelBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 0,
            margin_bottom: 5,
            margin_right: 10
        });

        let customAppsLabel = new Gtk.CheckButton({
            label: _("Use label with Apps button"),
            margin_left: 40,
            hexpand: true,
            halign: Gtk.Align.START
        });
        customAppsLabel.set_active(this.settings.get_boolean('use-panel-apps-label'));
        customAppsLabel.connect('toggled', Lang.bind(this, function(check) {
            this.settings.set_boolean('use-panel-apps-label', check.get_active());
        }));

        let customAppsLabelEntry = new Gtk.Entry({
            halign: Gtk.Align.END
        });
        customAppsLabelEntry.set_width_chars(15);
        customAppsLabelEntry.set_size_request(200, -1);
        customAppsLabelEntry.set_text(this.settings.get_strv('panel-apps-label-text')[0]);
        customAppsLabelEntry.connect('changed', Lang.bind(this, function(entry) {
            let iconName = entry.get_text();
            this.settings.set_strv('panel-apps-label-text', [iconName]);
        }));

        customAppsLabelBox.add(customAppsLabel);
        customAppsLabelBox.add(customAppsLabelEntry);


        let customAppsIconBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 0,
            margin_bottom: 5,
            margin_right: 10
        });
        let customAppsIcon = new Gtk.CheckButton({
            label: _("Use icon with Apps button"),
            margin_left: 40,
            hexpand: true,
            halign: Gtk.Align.START
        });
        customAppsIcon.set_active(this.settings.get_boolean('use-panel-apps-icon'));
        customAppsIcon.connect('toggled', Lang.bind(this, function(check) {
            this.settings.set_boolean('use-panel-apps-icon', check.get_active());
        }));

        let customAppsIconEntry = new Gtk.Entry({
            halign: Gtk.Align.END
        });
        customAppsIconEntry.set_width_chars(15);
        customAppsIconEntry.set_size_request(200, -1);
        customAppsIconEntry.set_text(this.settings.get_strv('panel-apps-icon-name')[0]);
        customAppsIconEntry.connect('changed', Lang.bind(this, function(entry) {
            let iconName = entry.get_text();
            this.settings.set_strv('panel-apps-icon-name', [iconName]);
        }));

        this.settings.bind('use-panel-apps-icon', customAppsIconEntry, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
        customAppsIconBox.add(customAppsIcon);
        customAppsIconBox.add(customAppsIconEntry);


        this.settings.bind('hide-panel-apps', panelAppsBox, 'sensitive', Gio.SettingsBindFlags.INVERT_BOOLEAN);
        panelAppsBox.add(customAppsLabelBox);
        panelAppsBox.add(customAppsIconBox);


        let hidePanelMenuBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let hidePanelMenuLabel = new Gtk.Label({
            label: _("Menu button"),
            use_markup: true,
            xalign: 0,
            hexpand: true
        });
        let hidePanelMenuSwitch = new Gtk.Switch ({
            halign: Gtk.Align.END
        });
        hidePanelMenuSwitch.set_active(!this.settings.get_boolean('hide-panel-menu'));
        hidePanelMenuSwitch.connect("notify::active", Lang.bind(this, function(check) {
            this.settings.set_boolean('hide-panel-menu', !check.get_active());
        }));

        hidePanelMenuBox.add(hidePanelMenuLabel);
        hidePanelMenuBox.add(hidePanelMenuSwitch);

        let customMenuLabelBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 0,
            margin_bottom: 5,
            margin_right: 10
        });

        let customMenuLabel = new Gtk.CheckButton({
            label: _("Use label with Menu button"),
            margin_left: 40,
            hexpand: true,
            halign: Gtk.Align.START
        });
        customMenuLabel.set_active(this.settings.get_boolean('use-panel-menu-label'));
        customMenuLabel.connect('toggled', Lang.bind(this, function(check) {
            this.settings.set_boolean('use-panel-menu-label', check.get_active());
        }));

        let customMenuLabelEntry = new Gtk.Entry({
            halign: Gtk.Align.END
        });
        customMenuLabelEntry.set_width_chars(15);
        customMenuLabelEntry.set_size_request(200, -1);
        customMenuLabelEntry.set_text(this.settings.get_strv('panel-menu-label-text')[0]);
        customMenuLabelEntry.connect('changed', Lang.bind(this, function(entry) {
            let iconName = entry.get_text();
            this.settings.set_strv('panel-menu-label-text', [iconName]);
        }));

        customMenuLabelBox.add(customMenuLabel);
        customMenuLabelBox.add(customMenuLabelEntry);

        let customMenuIconBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 0,
            margin_bottom: 5,
            margin_right: 10
        });
        let customMenuIcon = new Gtk.CheckButton({
            label: _("Use icon with Menu button"),
            margin_left: 40,
            hexpand: true,
            halign: Gtk.Align.START
        });
        customMenuIcon.set_active(this.settings.get_boolean('use-panel-menu-icon'));
        customMenuIcon.connect('toggled', Lang.bind(this, function(check) {
            this.settings.set_boolean('use-panel-menu-icon', check.get_active());
        }));

        let customMenuIconEntry = new Gtk.Entry({
            halign: Gtk.Align.END
        });
        customMenuIconEntry.set_width_chars(15);
        customMenuIconEntry.set_size_request(200, -1);
        customMenuIconEntry.set_text(this.settings.get_strv('panel-menu-icon-name')[0]);
        customMenuIconEntry.connect('changed', Lang.bind(this, function(entry) {
            let iconName = entry.get_text();
            this.settings.set_strv('panel-menu-icon-name', [iconName]);
        }));

        this.settings.bind('use-panel-menu-icon', customMenuIconEntry, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
        customMenuIconBox.add(customMenuIcon);
        customMenuIconBox.add(customMenuIconEntry);

        let panelMenuBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL
        });

        let hideMenuArrowBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 0,
            margin_bottom: 5,
            margin_right: 10
        });
        let hideMenuArrow = new Gtk.CheckButton({
            label: _("Hide Menu button arrow"),
            margin_left: 40
        });
        hideMenuArrow.set_active(this.settings.get_boolean('hide-panel-menu-arrow'));
        hideMenuArrow.connect('toggled', Lang.bind(this, function(check) {
            this.settings.set_boolean('hide-panel-menu-arrow', check.get_active());
        }));

        hideMenuArrowBox.add(hideMenuArrow);

        let disableMenuHotSpotBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 0,
            margin_bottom: 5,
            margin_right: 10
        });
        let disableMenuHotSpot = new Gtk.CheckButton({
            label: _("Disable Menu button hot spot"),
            margin_left: 40
        });
        disableMenuHotSpot.set_active(this.settings.get_boolean('disable-panel-menu-hotspot'));
        disableMenuHotSpot.connect('toggled', Lang.bind(this, function(check) {
            this.settings.set_boolean('disable-panel-menu-hotspot', check.get_active());
        }));

        disableMenuHotSpotBox.add(disableMenuHotSpot);

        let menuHotspotHoverDelays = [0, 100, 150, 175, 200, 250, 300, 350, 400];
        let menuHotspotHoverDelayBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 0,
            margin_bottom: 5,
            margin_right: 10
        });
        let menuHotspotHoverDelayLabel = new Gtk.Label({
            label: _("hot spot hover delay"),
            margin_left: 65,
            hexpand:true,
            halign: Gtk.Align.START
        });
        let menuHotspotHoverDelayCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            menuHotspotHoverDelayCombo.set_size_request(200, -1);
            menuHotspotHoverDelayCombo.append_text(_('0'));
            menuHotspotHoverDelayCombo.append_text(_('100'));
            menuHotspotHoverDelayCombo.append_text(_('150'));
            menuHotspotHoverDelayCombo.append_text(_('175'));
            menuHotspotHoverDelayCombo.append_text(_('200'));
            menuHotspotHoverDelayCombo.append_text(_('250'));
            menuHotspotHoverDelayCombo.append_text(_('300'));
            menuHotspotHoverDelayCombo.append_text(_('350'));
            menuHotspotHoverDelayCombo.append_text(_('400'));
            menuHotspotHoverDelayCombo.set_active(menuHotspotHoverDelays.indexOf(this.settings.get_int('panel-menu-hotspot-delay')));
            menuHotspotHoverDelayCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_int('panel-menu-hotspot-delay', menuHotspotHoverDelays[widget.get_active()]);
            }));

        menuHotspotHoverDelayBox.add(menuHotspotHoverDelayLabel);
        menuHotspotHoverDelayBox.add(menuHotspotHoverDelayCombo);
        this.settings.bind('disable-panel-menu-hotspot', menuHotspotHoverDelayBox, 'sensitive', Gio.SettingsBindFlags.INVERT_BOOLEAN);

        let disableMenuKeyboardAccelBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 0,
            margin_bottom: 5,
            margin_right: 10
        });
        let disableMenuKeyboardAccel = new Gtk.CheckButton({
            label: _("Disable Menu button shortcut key"),
            margin_left: 40,
            hexpand: true
        });
        disableMenuKeyboardAccel.set_active(this.settings.get_boolean('disable-panel-menu-keyboard'));
        disableMenuKeyboardAccel.connect('toggled', Lang.bind(this, function(check) {
            this.settings.set_boolean('disable-panel-menu-keyboard', check.get_active());
        }));

        let keyboardAccelEntry = new Gtk.Entry({
            halign: Gtk.Align.END
        });
        keyboardAccelEntry.set_width_chars(15);
        keyboardAccelEntry.set_size_request(200, -1);
        keyboardAccelEntry.set_text(this.settings.get_strv('panel-menu-keyboard-accelerator')[0]);
        keyboardAccelEntry.connect('changed', Lang.bind(this, function(entry) {
            let [key, mods] = Gtk.accelerator_parse(entry.get_text());
            if(Gtk.accelerator_valid(key, mods)) {
                keyboardAccelEntry["secondary-icon-name"] = null;
                keyboardAccelEntry["secondary-icon-tooltip-text"] = null;
                let shortcut = Gtk.accelerator_name(key, mods);
                this.settings.set_strv('panel-menu-keyboard-accelerator', [shortcut]);
            } else {
                keyboardAccelEntry["secondary-icon-name"] = "dialog-warning-symbolic";
                keyboardAccelEntry["secondary-icon-tooltip-text"] = _("Invalid accelerator. Try F12, <Super>space, <Ctrl><Alt><Shift>a, etc.");
            }
        }));

        this.settings.bind('disable-panel-menu-keyboard', keyboardAccelEntry, 'sensitive', Gio.SettingsBindFlags.INVERT_BOOLEAN);
        disableMenuKeyboardAccelBox.add(disableMenuKeyboardAccel);
        disableMenuKeyboardAccelBox.add(keyboardAccelEntry);

        let menuButtonPositionBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 0,
            margin_bottom: 5,
            margin_right: 10
        });

        let menuButtonPositionLabel = new Gtk.Label({
            label: _("Set Menu button position"),
            margin_left: 40,
            hexpand: true,
            halign: Gtk.Align.START
        });
        let menuButtonPositionCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            menuButtonPositionCombo.set_size_request(200, -1);
            menuButtonPositionCombo.append_text(_('Left'));
            menuButtonPositionCombo.append_text(_('Center'));
            menuButtonPositionCombo.append_text(_('Right'));
            menuButtonPositionCombo.set_active(this.settings.get_enum('panel-menu-position'));
            menuButtonPositionCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_enum('panel-menu-position', widget.get_active());
            }));

        menuButtonPositionBox.add(menuButtonPositionLabel);
        menuButtonPositionBox.add(menuButtonPositionCombo);

        this.settings.bind('hide-panel-menu', panelMenuBox, 'sensitive', Gio.SettingsBindFlags.INVERT_BOOLEAN);

        /* ADD TO PANEL MENU BUTTON */
        panelMenuBox.add(menuButtonPositionBox);
        panelMenuBox.add(customMenuLabelBox);
        panelMenuBox.add(customMenuIconBox);
        panelMenuBox.add(hideMenuArrowBox);
        panelMenuBox.add(disableMenuKeyboardAccelBox);
        panelMenuBox.add(disableMenuHotSpotBox);
        panelMenuBox.add(menuHotspotHoverDelayBox);

        /* ADD TO PANEL SETTINGS */
        // panelSettings.add(panelSettingsTitle);
        panelSettings.add(disableHotCornerBox);
        panelSettings.add(hidePanelViewBox);
        panelSettings.add(panelViewBox);
        panelSettings.add(hidePanelAppsBox);
        panelSettings.add(panelAppsBox);
        panelSettings.add(hidePanelMenuBox);
        panelSettings.add(panelMenuBox);

        /* ADD TO NOTEBOOK PAGE */
        notebookPanelButtons.add(panelMenuBox);
        notebookPanelButtons.add(panelSettings);
        notebook.append_page(notebookPanelButtons, notebookPanelButtonsTitle);


        /* MENU SETTINGS */

        let menuSettings = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 10,
            margin_bottom: 10
        });

        let menuSettingsTitle = new Gtk.Label({
            label: _("<b>Menu Settings</b>"),
            use_markup: true,
            xalign: 0,
            margin_top: 5,
            margin_bottom: 5
        });

        let menuLayoutBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let menuLayoutLabel = new Gtk.Label({label: _("Menu layout size"), hexpand:true, xalign:0});
        let menuLayoutCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            menuLayoutCombo.set_size_request(200, -1);
            menuLayoutCombo.append_text(_('Normal'));
            menuLayoutCombo.append_text(_('Compact'));
            menuLayoutCombo.set_active(this.settings.get_enum('menu-layout'));
            menuLayoutCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_enum('menu-layout', widget.get_active());
                    let selected = widget.get_active();
                    if (selected == 1) {
                        shortcutsIconSizeCombo.set_active(iconSizes.indexOf(24));
                        appsListIconSizeCombo.set_active(iconSizes.indexOf(16));
                        appsGridIconSizeCombo.set_active(iconSizes.indexOf(32));
                        if (this.settings.get_int('apps-grid-label-width') > 48 ) {
                            appsGridLabelWidthCombo.set_active(labelSizes.indexOf(48));
                        }
                    } else {
                        shortcutsIconSizeCombo.set_active(iconSizes.indexOf(32));
                        appsListIconSizeCombo.set_active(iconSizes.indexOf(24));
                        appsGridIconSizeCombo.set_active(iconSizes.indexOf(48));
                        if (this.settings.get_int('apps-grid-label-width') < 64 ) {
                            appsGridLabelWidthCombo.set_active(labelSizes.indexOf(64));
                        }
                    }
            }));

        menuLayoutBox.add(menuLayoutLabel);
        menuLayoutBox.add(menuLayoutCombo);

        let hideUserOptionsBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let hideUserOptionsLabel = new Gtk.Label({
            label: _("User Options Panel"),
            use_markup: true,
            xalign: 0,
            hexpand: true
        });
        let hideUserOptionsSwitch = new Gtk.Switch ({
            halign: Gtk.Align.END
        });
        hideUserOptionsSwitch.set_active(!this.settings.get_boolean('hide-useroptions'));
        hideUserOptionsSwitch.connect("notify::active", Lang.bind(this, function(check) {
            this.settings.set_boolean('hide-useroptions', !check.get_active());
        }));

        hideUserOptionsBox.add(hideUserOptionsLabel);
        hideUserOptionsBox.add(hideUserOptionsSwitch);

        let hideShortcutsBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let hideShortcutsLabel = new Gtk.Label({
            label: _("Shortcuts Panel"),
            use_markup: true,
            xalign: 0,
            hexpand: true
        });
        let hideShortcutsSwitch = new Gtk.Switch ({
            halign: Gtk.Align.END
        });
        hideShortcutsSwitch.set_active(!this.settings.get_boolean('hide-shortcuts'));
        hideShortcutsSwitch.connect("notify::active", Lang.bind(this, function(check) {
            this.settings.set_boolean('hide-shortcuts', !check.get_active());
        }));

        hideShortcutsBox.add(hideShortcutsLabel);
        hideShortcutsBox.add(hideShortcutsSwitch);

        let shortcutsPanelBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL
        });

        let shortcutAppsDisplayBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });

        let shortcutAppsDisplayLabel = new Gtk.Label({
            label: _("Icons to display on Shortcuts Panel"),
            margin_left: 40,
            hexpand:true,
            xalign:0
        });
        let shortcutAppsDisplayCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            shortcutAppsDisplayCombo.set_size_request(200, -1);
            shortcutAppsDisplayCombo.append_text(_('Favorites'));
            shortcutAppsDisplayCombo.append_text(_('Places'));
            shortcutAppsDisplayCombo.set_active(this.settings.get_enum('shortcuts-display'));
            shortcutAppsDisplayCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_enum('shortcuts-display', widget.get_active());
            }));

        shortcutAppsDisplayBox.add(shortcutAppsDisplayLabel);
        shortcutAppsDisplayBox.add(shortcutAppsDisplayCombo);

        let iconSizes = [16, 22, 24, 32, 48, 64];

        let shortcutsIconSizeBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let shortcutsIconSizeLabel = new Gtk.Label({
            label: _("Size of Shortcuts Panel icons"),
            margin_left: 40,
            hexpand:true,
            xalign:0
        });
        let shortcutsIconSizeCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            shortcutsIconSizeCombo.set_size_request(200, -1);
            shortcutsIconSizeCombo.append_text('16');
            shortcutsIconSizeCombo.append_text('22');
            shortcutsIconSizeCombo.append_text('24');
            shortcutsIconSizeCombo.append_text('32');
            shortcutsIconSizeCombo.append_text('48');
            shortcutsIconSizeCombo.append_text('64');
            shortcutsIconSizeCombo.set_active(iconSizes.indexOf(this.settings.get_int('shortcuts-icon-size')));
            shortcutsIconSizeCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_int('shortcuts-icon-size', iconSizes[widget.get_active()]);
            }));

        shortcutsIconSizeBox.add(shortcutsIconSizeLabel);
        shortcutsIconSizeBox.add(shortcutsIconSizeCombo);

        /* ADD TO SHORTCUTS PANEL BOX */
        shortcutsPanelBox.add(shortcutAppsDisplayBox);
        shortcutsPanelBox.add(shortcutsIconSizeBox);
        this.settings.bind('hide-shortcuts', shortcutsPanelBox, 'sensitive', Gio.SettingsBindFlags.INVERT_BOOLEAN);

        let hideCategoriesBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let hideCategoriesLabel = new Gtk.Label({
            label: _("Categories Panel"),
            use_markup: true,
            xalign: 0,
            hexpand: true
        });
        let hideCategoriesSwitch = new Gtk.Switch ({
            halign: Gtk.Align.END
        });
        hideCategoriesSwitch.set_active(!this.settings.get_boolean('hide-categories'));
        hideCategoriesSwitch.connect("notify::active", Lang.bind(this, function(check) {
            this.settings.set_boolean('hide-categories', !check.get_active());
        }));

        hideCategoriesBox.add(hideCategoriesLabel);
        hideCategoriesBox.add(hideCategoriesSwitch);

        let categoriesPanelBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL
        });

        let categorySelectMethodBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let categorySelectMethodLabel = new Gtk.Label({
            label: _("Category selection method"),
            margin_left: 40,
            hexpand:true,
            xalign:0
        });
        let categorySelectMethodCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            categorySelectMethodCombo.set_size_request(200, -1);
            categorySelectMethodCombo.append_text(_('Hover'));
            categorySelectMethodCombo.append_text(_('Click'));
            categorySelectMethodCombo.set_active(this.settings.get_enum('category-selection-method'));
            categorySelectMethodCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_enum('category-selection-method', widget.get_active());
            }));

        categorySelectMethodBox.add(categorySelectMethodLabel);
        categorySelectMethodBox.add(categorySelectMethodCombo);

        let hoverDelays = [0, 100, 150, 175, 200, 250, 400];
        let categoryHoverDelayBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let categoryHoverDelayLabel = new Gtk.Label({
            label: _("Menu hover delay"),
            margin_left: 40,
            hexpand:true,
            xalign:0
        });
        let categoryHoverDelayCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            categoryHoverDelayCombo.set_size_request(200, -1);
            categoryHoverDelayCombo.append_text(_('0'));
            categoryHoverDelayCombo.append_text(_('100'));
            categoryHoverDelayCombo.append_text(_('150'));
            categoryHoverDelayCombo.append_text(_('175'));
            categoryHoverDelayCombo.append_text(_('200'));
            categoryHoverDelayCombo.append_text(_('250'));
            categoryHoverDelayCombo.append_text(_('400'));
            categoryHoverDelayCombo.set_active(hoverDelays.indexOf(this.settings.get_int('category-hover-delay')));
            categoryHoverDelayCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_int('category-hover-delay', hoverDelays[widget.get_active()]);
            }));

        categoryHoverDelayBox.add(categoryHoverDelayLabel);
        categoryHoverDelayBox.add(categoryHoverDelayCombo);

        /* ADD TO CATEGORIES PANEL BOX */
        categoriesPanelBox.add(categorySelectMethodBox);
        categoriesPanelBox.add(categoryHoverDelayBox);
        this.settings.bind('hide-categories', categoriesPanelBox, 'sensitive', Gio.SettingsBindFlags.INVERT_BOOLEAN);

        let hideThumbnailsBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let hideThumbnailsLabel = new Gtk.Label({
            label: _("Workspace Thumbnails Panel"),
            use_markup: true,
            xalign: 0,
            hexpand: true
        });
        let hideThumbnailsSwitch = new Gtk.Switch ({
            halign: Gtk.Align.END
        });
        hideThumbnailsSwitch.set_active(!this.settings.get_boolean('hide-workspaces'));
        hideThumbnailsSwitch.connect("notify::active", Lang.bind(this, function(check) {
            this.settings.set_boolean('hide-workspaces', !check.get_active());
        }));

        hideThumbnailsBox.add(hideThumbnailsLabel);
        hideThumbnailsBox.add(hideThumbnailsSwitch);

        /* ADD TO MENU SETTINGS */
        // menuSettings.add(menuSettingsTitle);
        menuSettings.add(menuLayoutBox);
        menuSettings.add(hideUserOptionsBox);
        menuSettings.add(hideShortcutsBox);
        menuSettings.add(shortcutsPanelBox)
        menuSettings.add(hideCategoriesBox);
        menuSettings.add(categoriesPanelBox);
        menuSettings.add(hideThumbnailsBox);

        /* ADD TO NOTEBOOK PAGE */
        notebookMenuPanels.add(menuSettings);
        notebook.append_page(notebookMenuPanels, notebookMenuPanelsTitle);


        /* APPS GRID-LIST SETTINGS */

        let appsSettings = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 10,
            margin_bottom: 10
        });

        let appsSettingsTitle = new Gtk.Label({
            label: _("<b>Apps Settings</b>"),
            use_markup: true,
            xalign: 0,
            margin_top: 5,
            margin_bottom: 5
        });

        let startupAppsDisplayBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let startupAppsDisplayLabel = new Gtk.Label({label: _("Applications to display at startup"),
                                                        hexpand:true, xalign:0});
        let startupAppsDisplayCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            startupAppsDisplayCombo.set_size_request(200, -1);
            startupAppsDisplayCombo.append_text(_('All'));
            startupAppsDisplayCombo.append_text(_('Frequent'));
            startupAppsDisplayCombo.append_text(_('Favorites'));
            startupAppsDisplayCombo.append_text(_('Recent'));
            startupAppsDisplayCombo.append_text(_('WebBookmarks'));
            startupAppsDisplayCombo.append_text(_('None'));
            startupAppsDisplayCombo.set_active(this.settings.get_enum('startup-apps-display'));
            startupAppsDisplayCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_enum('startup-apps-display', widget.get_active());
            }));

        startupAppsDisplayBox.add(startupAppsDisplayLabel);
        startupAppsDisplayBox.add(startupAppsDisplayCombo);

        let startupViewModeBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let startupViewModeLabel = new Gtk.Label({label: _("Default view mode for applications"),
                                                    hexpand:true, xalign:0});
        let startupViewModeCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            startupViewModeCombo.set_size_request(200, -1);
            startupViewModeCombo.append_text(_('List'));
            startupViewModeCombo.append_text(_('Grid'));
            startupViewModeCombo.set_active(this.settings.get_enum('startup-view-mode'));
            startupViewModeCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_enum('startup-view-mode', widget.get_active());
            }));

        startupViewModeBox.add(startupViewModeLabel);
        startupViewModeBox.add(startupViewModeCombo);

        let appsGridBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL
        });

        let columnCount = [3, 4, 5 , 6, 7];
        let appsGridColumnCountBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let appsGridColumnCountLabel = new Gtk.Label({
            label: _("<u>Grid:</u> Number of columns"),
            margin_left: 40,
            use_markup: true,
            hexpand:true,
            xalign:0
        });
        let appsGridColumnCountCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            appsGridColumnCountCombo.set_size_request(200, -1);
            appsGridColumnCountCombo.append_text(_('3'));
            appsGridColumnCountCombo.append_text(_('4'));
            appsGridColumnCountCombo.append_text(_('5'));
            appsGridColumnCountCombo.append_text(_('6'));
            appsGridColumnCountCombo.append_text(_('7'));
            appsGridColumnCountCombo.set_active(columnCount.indexOf(this.settings.get_int('apps-grid-column-count')));
            appsGridColumnCountCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_int('apps-grid-column-count', columnCount[widget.get_active()]);
            }));

        appsGridColumnCountBox.add(appsGridColumnCountLabel);
        appsGridColumnCountBox.add(appsGridColumnCountCombo);

        let labelSizes = [0, 32, 48, 64, 80, 96, 112, 128];
        let appsGridLabelWidthBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let appsGridLabelWidthLabel = new Gtk.Label({
            label: _("<u>Grid:</u> Width of Application labels"),
            margin_left: 40,
            use_markup: true,
            hexpand:true,
            xalign:0
        });
        let appsGridLabelWidthCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            appsGridLabelWidthCombo.set_size_request(200, -1);
            appsGridLabelWidthCombo.append_text(_('0'));
            appsGridLabelWidthCombo.append_text(_('32'));
            appsGridLabelWidthCombo.append_text(_('48'));
            appsGridLabelWidthCombo.append_text(_('64'));
            appsGridLabelWidthCombo.append_text(_('80'));
            appsGridLabelWidthCombo.append_text(_('96'));
            appsGridLabelWidthCombo.append_text(_('112'));
            appsGridLabelWidthCombo.append_text(_('128'));
            appsGridLabelWidthCombo.set_active(labelSizes.indexOf(this.settings.get_int('apps-grid-label-width')));
            appsGridLabelWidthCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_int('apps-grid-label-width', labelSizes[widget.get_active()]);
            }));

        appsGridLabelWidthBox.add(appsGridLabelWidthLabel);
        appsGridLabelWidthBox.add(appsGridLabelWidthCombo);

        let appsGridIconSizeBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let appsGridIconSizeLabel = new Gtk.Label({
            label: _("<u>Grid:</u> Size of Application icons"),
            margin_left: 40,
            use_markup: true,
            hexpand:true,
            xalign:0
        });
        let appsGridIconSizeCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            appsGridIconSizeCombo.set_size_request(200, -1);
            appsGridIconSizeCombo.append_text('16');
            appsGridIconSizeCombo.append_text('22');
            appsGridIconSizeCombo.append_text('24');
            appsGridIconSizeCombo.append_text('32');
            appsGridIconSizeCombo.append_text('48');
            appsGridIconSizeCombo.append_text('64');
            appsGridIconSizeCombo.set_active(iconSizes.indexOf(this.settings.get_int('apps-grid-icon-size')));
            appsGridIconSizeCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_int('apps-grid-icon-size', iconSizes[widget.get_active()]);
            }));

        appsGridIconSizeBox.add(appsGridIconSizeLabel);
        appsGridIconSizeBox.add(appsGridIconSizeCombo);

        /* ADD TO APPS GRID BOX */
        appsGridBox.add(appsGridColumnCountBox);
        appsGridBox.add(appsGridLabelWidthBox);
        appsGridBox.add(appsGridIconSizeBox);
        // this.settings.bind('startup-view-mode', appsGridBox, 'sensitive', Gio.SettingsBindFlags.DEFAULT);

        let appsListBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL
        });

        let appsListIconSizeBox = new Gtk.Box({
            spacing: 20,
            orientation: Gtk.Orientation.HORIZONTAL,
            homogeneous: false,
            margin_left: 20,
            margin_top: 5,
            margin_bottom: 5,
            margin_right: 10
        });
        let appsListIconSizeLabel = new Gtk.Label({
            label: _("<u>List:</u> Size of Application icons"),
            margin_left: 40,
            use_markup: true,
            hexpand:true,
            xalign:0
        });
        let appsListIconSizeCombo = new Gtk.ComboBoxText({halign:Gtk.Align.END});
            appsListIconSizeCombo.set_size_request(200, -1);
            appsListIconSizeCombo.append_text('16');
            appsListIconSizeCombo.append_text('22');
            appsListIconSizeCombo.append_text('24');
            appsListIconSizeCombo.append_text('32');
            appsListIconSizeCombo.append_text('48');
            appsListIconSizeCombo.append_text('64');
            appsListIconSizeCombo.set_active(iconSizes.indexOf(this.settings.get_int('apps-list-icon-size')));
            appsListIconSizeCombo.connect('changed', Lang.bind (this, function(widget) {
                    this.settings.set_int('apps-list-icon-size', iconSizes[widget.get_active()]);
            }));

        appsListIconSizeBox.add(appsListIconSizeLabel);
        appsListIconSizeBox.add(appsListIconSizeCombo);

        /* ADD TO APPS LIST BOX */
        appsListBox.add(appsListIconSizeBox);
        // this.settings.bind('startup-view-mode', appsListBox, 'sensitive', Gio.SettingsBindFlags.DEFAULT);

        /* ADD TO APPS SETTINGS */
        // appsSettings.add(appsSettingsTitle);
        appsSettings.add(startupAppsDisplayBox);
        appsSettings.add(startupViewModeBox);
        appsSettings.add(appsGridBox);
        appsSettings.add(appsListBox);


        /* ADD TO NOTEBOOK PAGE */
        notebookAppsGrid.add(appsSettings);
        notebook.append_page(notebookAppsGrid, notebookAppsGridTitle);


        // frame.add(panelSettings);
        // frame.add(appsSettings);
        //this.add(frame);

        // let scrollWindow = new Gtk.ScrolledWindow({
        //     'hscrollbar-policy': Gtk.PolicyType.AUTOMATIC,
        //     'vscrollbar-policy': Gtk.PolicyType.AUTOMATIC,
        //     'hexpand': true, 'vexpand': true,
        //     'min-content-height': 500
        // });
        // scrollWindow.add_with_viewport(frame);

        // this.add(scrollWindow);

        this.add(notebook);

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
