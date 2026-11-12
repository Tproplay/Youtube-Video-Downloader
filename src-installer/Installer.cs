using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace YouTubeDownloaderInstaller
{
    public class InstallerForm : Form
    {
        private ProgressBar progressBar;
        private Label lblTitle;
        private Label lblSubtitle;
        private Label lblStatus;
        private Label lblDest;
        private Button btnInstall;
        private Button btnCancel;
        private Panel pnlHeader;
        private PictureBox picIcon;
        private string targetDir;

        public InstallerForm()
        {
            this.Text = "YouTube Video Downloader Setup";
            this.Size = new Size(520, 360);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.BackColor = Color.FromArgb(20, 20, 26);
            this.ForeColor = Color.FromArgb(240, 240, 248);
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular);

            try
            {
                this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch { }

            targetDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs",
                "YouTube Video Downloader"
            );

            InitializeUI();
        }

        private void InitializeUI()
        {
            // Header panel
            pnlHeader = new Panel();
            pnlHeader.Dock = DockStyle.Top;
            pnlHeader.Height = 85;
            pnlHeader.BackColor = Color.FromArgb(14, 14, 18);
            pnlHeader.Padding = new Padding(20, 16, 20, 16);

            picIcon = new PictureBox();
            picIcon.Size = new Size(52, 52);
            picIcon.Location = new Point(20, 16);
            picIcon.SizeMode = PictureBoxSizeMode.Zoom;
            try
            {
                if (this.Icon != null) picIcon.Image = this.Icon.ToBitmap();
            }
            catch { }

            lblTitle = new Label();
            lblTitle.Text = "YouTube Video Downloader";
            lblTitle.Font = new Font("Segoe UI", 13.5F, FontStyle.Bold);
            lblTitle.ForeColor = Color.White;
            lblTitle.Location = new Point(84, 16);
            lblTitle.AutoSize = true;

            lblSubtitle = new Label();
            lblSubtitle.Text = "Standalone Desktop Application Setup (Offline Installer)";
            lblSubtitle.Font = new Font("Segoe UI", 9F, FontStyle.Regular);
            lblSubtitle.ForeColor = Color.FromArgb(160, 160, 175);
            lblSubtitle.Location = new Point(85, 44);
            lblSubtitle.AutoSize = true;

            pnlHeader.Controls.Add(picIcon);
            pnlHeader.Controls.Add(lblTitle);
            pnlHeader.Controls.Add(lblSubtitle);
            this.Controls.Add(pnlHeader);

            // Destination directory info
            lblDest = new Label();
            lblDest.Text = "Install Location:\n" + targetDir;
            lblDest.Location = new Point(24, 105);
            lblDest.Size = new Size(470, 42);
            lblDest.ForeColor = Color.FromArgb(180, 180, 195);
            this.Controls.Add(lblDest);

            // Status label
            lblStatus = new Label();
            lblStatus.Text = "Click 'Install' to install on your computer.";
            lblStatus.Location = new Point(24, 160);
            lblStatus.Size = new Size(470, 22);
            lblStatus.ForeColor = Color.FromArgb(220, 220, 230);
            this.Controls.Add(lblStatus);

            // Progress bar
            progressBar = new ProgressBar();
            progressBar.Location = new Point(24, 190);
            progressBar.Size = new Size(468, 24);
            progressBar.Minimum = 0;
            progressBar.Maximum = 100;
            progressBar.Value = 0;
            this.Controls.Add(progressBar);

            // Bottom Buttons
            btnInstall = new Button();
            btnInstall.Text = "Install";
            btnInstall.Size = new Size(110, 36);
            btnInstall.Location = new Point(266, 260);
            btnInstall.BackColor = Color.FromArgb(230, 20, 50);
            btnInstall.ForeColor = Color.White;
            btnInstall.FlatStyle = FlatStyle.Flat;
            btnInstall.FlatAppearance.BorderSize = 0;
            btnInstall.Font = new Font("Segoe UI", 9.5F, FontStyle.Bold);
            btnInstall.Cursor = Cursors.Hand;
            btnInstall.Click += BtnInstall_Click;
            this.Controls.Add(btnInstall);

            btnCancel = new Button();
            btnCancel.Text = "Cancel";
            btnCancel.Size = new Size(95, 36);
            btnCancel.Location = new Point(386, 260);
            btnCancel.BackColor = Color.FromArgb(38, 38, 48);
            btnCancel.ForeColor = Color.FromArgb(200, 200, 215);
            btnCancel.FlatStyle = FlatStyle.Flat;
            btnCancel.FlatAppearance.BorderSize = 0;
            btnCancel.Cursor = Cursors.Hand;
            btnCancel.Click += (s, e) => this.Close();
            this.Controls.Add(btnCancel);
        }

        private void BtnInstall_Click(object sender, EventArgs e)
        {
            if (btnInstall.Text == "Finish")
            {
                this.Close();
                return;
            }

            btnInstall.Enabled = false;
            btnInstall.Text = "Installing...";
            btnCancel.Enabled = false;

            Thread worker = new Thread(DoInstallation);
            worker.IsBackground = true;
            worker.Start();
        }

        private void UpdateProgress(string status, int percent)
        {
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action(() => UpdateProgress(status, percent)));
                return;
            }
            lblStatus.Text = status;
            progressBar.Value = Math.Min(100, Math.Max(0, percent));
        }

        private void DoInstallation()
        {
            try
            {
                UpdateProgress("Extracting installation payload...", 15);

                string tempZip = Path.Combine(Path.GetTempPath(), "ytdl_setup_" + Guid.NewGuid().ToString("N") + ".zip");
                Assembly asm = Assembly.GetExecutingAssembly();

                using (Stream stream = asm.GetManifestResourceStream("app_payload.zip"))
                {
                    if (stream == null)
                    {
                        throw new Exception("Embedded installation payload was not found inside setup executable.");
                    }
                    using (FileStream fs = new FileStream(tempZip, FileMode.Create, FileAccess.Write))
                    {
                        stream.CopyTo(fs);
                    }
                }

                UpdateProgress("Preparing destination folder...", 30);
                if (Directory.Exists(targetDir))
                {
                    try
                    {
                        // Terminate running server if existing
                        Process proc = Process.Start(new ProcessStartInfo("taskkill", "/F /IM node.exe") { WindowStyle = ProcessWindowStyle.Hidden });
                        if (proc != null) proc.WaitForExit(2000);
                    }
                    catch { }
                }
                else
                {
                    Directory.CreateDirectory(targetDir);
                }

                UpdateProgress("Installing application files & bundled runtimes...", 55);
                ZipFile.ExtractToDirectory(tempZip, targetDir);

                try { File.Delete(tempZip); } catch { }

                UpdateProgress("Creating Windows Search & Start Menu shortcuts...", 75);
                CreateShortcuts(targetDir);

                UpdateProgress("Registering uninstaller in Windows...", 88);
                RegisterUninstaller(targetDir);

                UpdateProgress("Launching YouTube Video Downloader...", 95);
                string vbsPath = Path.Combine(targetDir, "start-hidden.vbs");
                if (File.Exists(vbsPath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo("wscript.exe", "\"" + vbsPath + "\"");
                    psi.WorkingDirectory = targetDir;
                    psi.WindowStyle = ProcessWindowStyle.Hidden;
                    Process.Start(psi);
                }

                UpdateProgress("Installation Complete!", 100);

                this.BeginInvoke(new Action(() =>
                {
                    lblStatus.ForeColor = Color.FromArgb(60, 220, 100);
                    lblStatus.Text = "âœ” Installation Complete! The app has launched.";
                    btnInstall.Text = "Finish";
                    btnInstall.Enabled = true;
                    btnInstall.BackColor = Color.FromArgb(40, 160, 70);

                    // Auto-close after 2.5 seconds
                    System.Windows.Forms.Timer autoClose = new System.Windows.Forms.Timer();
                    autoClose.Interval = 2500;
                    autoClose.Tick += (s, ev) =>
                    {
                        autoClose.Stop();
                        this.Close();
                    };
                    autoClose.Start();
                }));
            }
            catch (Exception ex)
            {
                this.BeginInvoke(new Action(() =>
                {
                    lblStatus.ForeColor = Color.FromArgb(255, 80, 80);
                    lblStatus.Text = "Error: " + ex.Message;
                    btnCancel.Enabled = true;
                    btnCancel.Text = "Close";
                    MessageBox.Show(this, "Installation failed: " + ex.Message, "Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }));
            }
        }

        private void CreateShortcuts(string appDir)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                dynamic shell = Activator.CreateInstance(shellType);

                string vbsPath = Path.Combine(appDir, "start-hidden.vbs");
                string icoPath = Path.Combine(appDir, "assets", "app.ico");

                // 1. Start Menu (Indexed by Windows Search)
                string startMenu = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                string startShortcutPath = Path.Combine(startMenu, "YouTube Video Downloader.lnk");

                dynamic s1 = shell.CreateShortcut(startShortcutPath);
                s1.TargetPath = "C:\\Windows\\System32\\wscript.exe";
                s1.Arguments = "\"" + vbsPath + "\"";
                s1.WorkingDirectory = appDir;
                s1.IconLocation = icoPath + ",0";
                s1.Description = "YouTube Video Downloader - Fast, local, high-fidelity media downloader";
                s1.Save();

                // 2. Desktop Shortcut
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                string desktopShortcutPath = Path.Combine(desktop, "YouTube Video Downloader.lnk");

                dynamic s2 = shell.CreateShortcut(desktopShortcutPath);
                s2.TargetPath = "C:\\Windows\\System32\\wscript.exe";
                s2.Arguments = "\"" + vbsPath + "\"";
                s2.WorkingDirectory = appDir;
                s2.IconLocation = icoPath + ",0";
                s2.Description = "YouTube Video Downloader - Fast, local, high-fidelity media downloader";
                s2.Save();
            }
            catch (Exception ex)
            {
                Debug.WriteLine("Shortcut creation error: " + ex.Message);
            }
        }

        private void RegisterUninstaller(string appDir)
        {
            try
            {
                string uninstallerVbs = Path.Combine(appDir, "uninstall.vbs");
                string vbsContent = 
                    "Set WshShell = CreateObject(\"WScript.Shell\")\r\n" +
                    "Set FSO = CreateObject(\"Scripting.FileSystemObject\")\r\n" +
                    "ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)\r\n\r\n" +
                    "ans = MsgBox(\"Are you sure you want to completely uninstall YouTube Video Downloader?\", 36, \"Uninstall YouTube Video Downloader\")\r\n" +
                    "If ans <> 6 Then WScript.Quit\r\n\r\n" +
                    "On Error Resume Next\r\n" +
                    "WshShell.Run \"taskkill /F /IM node.exe\", 0, True\r\n" +
                    "StartMenu = WshShell.SpecialFolders(\"Programs\")\r\n" +
                    "Desktop = WshShell.SpecialFolders(\"Desktop\")\r\n" +
                    "If FSO.FileExists(StartMenu & \"\\YouTube Video Downloader.lnk\") Then FSO.DeleteFile StartMenu & \"\\YouTube Video Downloader.lnk\", True\r\n" +
                    "If FSO.FileExists(Desktop & \"\\YouTube Video Downloader.lnk\") Then FSO.DeleteFile Desktop & \"\\YouTube Video Downloader.lnk\", True\r\n" +
                    "WshShell.RegDelete \"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\YouTubeVideoDownloader\\\"\r\n" +
                    "WshShell.Run \"cmd.exe /c ping 127.0.0.1 -n 2 > nul & rmdir /s /q \"\"\" & ScriptDir & \"\"\"\", 0, False\r\n" +
                    "MsgBox \"YouTube Video Downloader has been completely removed from your computer.\", 64, \"Uninstall Complete\"\r\n";

                File.WriteAllText(uninstallerVbs, vbsContent);

                string keyPath = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\YouTubeVideoDownloader";
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(keyPath))
                {
                    if (key != null)
                    {
                        key.SetValue("DisplayName", "YouTube Video Downloader");
                        key.SetValue("DisplayVersion", "1.0.0");
                        key.SetValue("Publisher", "YouTube Video Downloader");
                        key.SetValue("DisplayIcon", Path.Combine(appDir, "assets", "app.ico") + ",0");
                        key.SetValue("InstallLocation", appDir);
                        key.SetValue("UninstallString", "wscript.exe \"" + uninstallerVbs + "\"");
                        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("Uninstaller registration error: " + ex.Message);
            }
        }

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
        }
    }
}
