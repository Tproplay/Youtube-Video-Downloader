using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace YouTubeDownloaderTray
{
    static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string iconPath = args.Length > 0 ? args[0] : "";

            Form hiddenForm = new Form
            {
                ShowInTaskbar = false,
                WindowState = FormWindowState.Minimized,
                FormBorderStyle = FormBorderStyle.None,
                Opacity = 0,
                Width = 0,
                Height = 0
            };
            // Ensure window handle exists for SetForegroundWindow & BeginInvoke
            IntPtr handle = hiddenForm.Handle;

            NotifyIcon notifyIcon = new NotifyIcon
            {
                Text = "YouTube Video Downloader",
                Visible = false
            };

            if (!string.IsNullOrEmpty(iconPath) && File.Exists(iconPath))
            {
                try
                {
                    notifyIcon.Icon = new Icon(iconPath);
                }
                catch
                {
                    notifyIcon.Icon = SystemIcons.Application;
                }
            }
            else
            {
                notifyIcon.Icon = SystemIcons.Application;
            }

            ContextMenuStrip menu = new ContextMenuStrip();

            ToolStripMenuItem openItem = new ToolStripMenuItem("Open YouTube Downloader");
            openItem.Font = new Font(openItem.Font, FontStyle.Bold);
            openItem.Click += (s, e) =>
            {
                Console.Out.WriteLine("OPEN");
                Console.Out.Flush();
            };

            ToolStripMenuItem quitItem = new ToolStripMenuItem("Quit");
            quitItem.Click += (s, e) =>
            {
                Console.Out.WriteLine("QUIT");
                Console.Out.Flush();
                notifyIcon.Visible = false;
                notifyIcon.Dispose();
                Application.Exit();
            };

            menu.Items.Add(openItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(quitItem);

            notifyIcon.MouseUp += (s, e) =>
            {
                if (e.Button == MouseButtons.Left)
                {
                    Console.Out.WriteLine("OPEN");
                    Console.Out.Flush();
                }
                else if (e.Button == MouseButtons.Right)
                {
                    SetForegroundWindow(hiddenForm.Handle);
                    menu.Show(Cursor.Position);
                }
            };

            notifyIcon.Visible = true;

            Thread stdinThread = new Thread(() =>
            {
                try
                {
                    while (true)
                    {
                        string line = Console.In.ReadLine();
                        if (line == null || line.Trim().Equals("EXIT", StringComparison.OrdinalIgnoreCase))
                        {
                            break;
                        }
                    }
                }
                catch { }

                try
                {
                    if (hiddenForm.IsHandleCreated && !hiddenForm.IsDisposed)
                    {
                        hiddenForm.BeginInvoke((Action)(() =>
                        {
                            notifyIcon.Visible = false;
                            notifyIcon.Dispose();
                            Application.Exit();
                        }));
                    }
                    else
                    {
                        Application.Exit();
                    }
                }
                catch
                {
                    Environment.Exit(0);
                }
            })
            {
                IsBackground = true
            };
            stdinThread.Start();

            Application.Run();

            notifyIcon.Visible = false;
            notifyIcon.Dispose();
        }
    }
}
