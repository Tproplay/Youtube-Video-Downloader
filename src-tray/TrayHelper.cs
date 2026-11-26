using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace YouTubeDownloaderTray
{
    internal sealed class ChromeDarkRenderer : ToolStripRenderer
    {
        private static readonly Color BgColor = Color.FromArgb(32, 33, 36);        // #202124
        private static readonly Color BorderColor = Color.FromArgb(60, 64, 67);    // #3C4043
        private static readonly Color HoverColor = Color.FromArgb(53, 54, 58);     // #35363A
        private static readonly Color TextColor = Color.FromArgb(232, 234, 237);   // #E8EAED
        private static readonly Color SepColor = Color.FromArgb(60, 64, 67);       // #3C4043

        protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs e)
        {
            using (var brush = new SolidBrush(BgColor))
            {
                e.Graphics.FillRectangle(brush, e.AffectedBounds);
            }
        }

        protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e)
        {
            using (var pen = new Pen(BorderColor, 1))
            {
                var r = new Rectangle(0, 0, e.AffectedBounds.Width - 1, e.AffectedBounds.Height - 1);
                e.Graphics.DrawRectangle(pen, r);
            }
        }

        protected override void OnRenderImageMargin(ToolStripRenderEventArgs e)
        {
            // Suppress default light image margin background
        }

        protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
        {
            if (!e.Item.Selected) return;

            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            var rect = new Rectangle(6, 2, e.Item.Width - 12, e.Item.Height - 4);
            using (var path = CreateRoundedRect(rect, 6))
            using (var brush = new SolidBrush(HoverColor))
            {
                e.Graphics.FillPath(brush, path);
            }
        }

        protected override void OnRenderItemImage(ToolStripItemImageRenderEventArgs e)
        {
            if (e.Image == null) return;
            e.Graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            const int iconSize = 18;
            int y = (e.Item.Height - iconSize) / 2;
            e.Graphics.DrawImage(e.Image, new Rectangle(16, y, iconSize, iconSize));
        }

        protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
        {
            e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
            const int textX = 44;
            var rect = new Rectangle(textX, 0, Math.Max(10, e.Item.Width - textX - 16), e.Item.Height);
            TextRenderer.DrawText(
                e.Graphics,
                e.Text,
                e.TextFont,
                rect,
                TextColor,
                TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.SingleLine | TextFormatFlags.NoPrefix
            );
        }

        protected override void OnRenderSeparator(ToolStripSeparatorRenderEventArgs e)
        {
            int y = e.Item.Height / 2;
            using (var pen = new Pen(SepColor, 1))
            {
                e.Graphics.DrawLine(pen, 1, y, e.Item.Width - 2, y);
            }
        }

        private static GraphicsPath CreateRoundedRect(Rectangle bounds, int radius)
        {
            int d = radius * 2;
            var path = new GraphicsPath();
            path.AddArc(bounds.X, bounds.Y, d, d, 180, 90);
            path.AddArc(bounds.Right - d, bounds.Y, d, d, 270, 90);
            path.AddArc(bounds.Right - d, bounds.Bottom - d, d, d, 0, 90);
            path.AddArc(bounds.X, bounds.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }
    }

    static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        private const int DWMWA_WINDOW_CORNER_PREFERENCE = 33;
        private const int DWMWCP_ROUND = 2;

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
            IntPtr handle = hiddenForm.Handle;

            Icon appIcon = SystemIcons.Application;
            if (!string.IsNullOrEmpty(iconPath) && File.Exists(iconPath))
            {
                try
                {
                    appIcon = new Icon(iconPath);
                }
                catch { }
            }

            NotifyIcon notifyIcon = new NotifyIcon
            {
                Text = "YouTube Video Downloader",
                Icon = appIcon,
                Visible = false
            };

            Font menuFont = new Font("Segoe UI", 9.75f, FontStyle.Regular);
            ContextMenuStrip menu = new ContextMenuStrip
            {
                Renderer = new ChromeDarkRenderer(),
                ShowImageMargin = true,
                ShowCheckMargin = false,
                Font = menuFont,
                Padding = new Padding(0, 6, 0, 6),
                AutoSize = true
            };

            menu.HandleCreated += (s, e) =>
            {
                try
                {
                    int pref = DWMWCP_ROUND;
                    DwmSetWindowAttribute(menu.Handle, DWMWA_WINDOW_CORNER_PREFERENCE, ref pref, sizeof(int));
                }
                catch { }
            };

            Image openBmp = null;
            try
            {
                openBmp = new Bitmap(appIcon.ToBitmap(), new Size(18, 18));
            }
            catch { }

            string openText = "Open YouTube Downloader";
            Size measured = TextRenderer.MeasureText(openText, menuFont, new Size(int.MaxValue, int.MaxValue), TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine);
            // 44px left offset (16px left pad + 18px icon + 10px gap) + text + 16px right pad
            int itemWidth = Math.Max(210, 44 + measured.Width + 16);

            ToolStripMenuItem openItem = new ToolStripMenuItem(openText, openBmp)
            {
                AutoSize = false,
                Height = 34,
                Width = itemWidth
            };
            openItem.Click += (s, e) =>
            {
                Console.Out.WriteLine("OPEN");
                Console.Out.Flush();
            };

            ToolStripSeparator sep = new ToolStripSeparator
            {
                AutoSize = false,
                Height = 10,
                Width = itemWidth
            };

            ToolStripMenuItem quitItem = new ToolStripMenuItem("Exit")
            {
                AutoSize = false,
                Height = 34,
                Width = itemWidth
            };
            quitItem.Click += (s, e) =>
            {
                Console.Out.WriteLine("QUIT");
                Console.Out.Flush();
                notifyIcon.Visible = false;
                notifyIcon.Dispose();
                Application.Exit();
            };

            menu.Items.Add(openItem);
            menu.Items.Add(sep);
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
