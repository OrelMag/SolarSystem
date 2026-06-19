using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text.RegularExpressions;
using System.Threading;

internal static class SolarSystemLauncher
{
    private const string Url = "http://127.0.0.1:5173/";
    private static Process serverProcess;
    private static bool openedBrowser;
    private static string nodePath;
    private static string npmPath;

    private static int Main()
    {
        Console.Title = "Solar System Simulation";

        string projectDir = FindProjectDirectory();
        if (projectDir == null)
        {
            Console.Error.WriteLine("Could not find package.json next to this launcher or in a parent directory.");
            Console.Error.WriteLine("Place SolarSystem.exe in the SolarSystem project folder and try again.");
            Pause();
            return 1;
        }

        nodePath = ResolveExecutable("node.exe");
        npmPath = ResolveExecutable("npm.cmd");

        if (nodePath == null || npmPath == null || !CommandExists(nodePath, "--version") || !CommandExists(npmPath, "--version"))
        {
            Console.Error.WriteLine("Node.js and npm are required to launch the simulation.");
            Console.Error.WriteLine("Install Node.js, then run this launcher again.");
            Pause();
            return 1;
        }

        if (!Directory.Exists(Path.Combine(projectDir, "node_modules")))
        {
            Console.WriteLine("Installing dependencies...");
            int installExitCode = RunAndWait(projectDir, npmPath, "install");
            if (installExitCode != 0)
            {
                Console.Error.WriteLine("npm install failed with exit code " + installExitCode + ".");
                Pause();
                return installExitCode;
            }
        }

        Console.CancelKeyPress += delegate
        {
            StopServer();
        };
        AppDomain.CurrentDomain.ProcessExit += delegate
        {
            StopServer();
        };

        Console.WriteLine("Starting Solar System simulation...");
        Console.WriteLine("Opening " + Url);
        Console.WriteLine("Close this window or press Ctrl+C to stop the simulation.");

        serverProcess = Start(projectDir, npmPath, "run dev -- --host 127.0.0.1 --port 5173 --strictPort");
        serverProcess.OutputDataReceived += HandleServerLine;
        serverProcess.ErrorDataReceived += HandleServerLine;
        serverProcess.BeginOutputReadLine();
        serverProcess.BeginErrorReadLine();

        WaitForServerThenOpenBrowser();
        serverProcess.WaitForExit();
        return serverProcess.ExitCode;
    }

    private static string FindProjectDirectory()
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        while (!string.IsNullOrEmpty(dir))
        {
            if (File.Exists(Path.Combine(dir, "package.json")))
            {
                return dir;
            }

            DirectoryInfo parent = Directory.GetParent(dir);
            dir = parent == null ? null : parent.FullName;
        }

        return null;
    }

    private static string ResolveExecutable(string fileName)
    {
        if (File.Exists(fileName)) return Path.GetFullPath(fileName);

        string path = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        foreach (string dir in path.Split(Path.PathSeparator))
        {
            if (string.IsNullOrWhiteSpace(dir)) continue;

            try
            {
                string candidate = Path.Combine(dir.Trim(), fileName);
                if (File.Exists(candidate)) return candidate;
            }
            catch
            {
            }
        }

        return null;
    }

    private static bool CommandExists(string fileName, string arguments)
    {
        try
        {
            Process process = Start(Environment.CurrentDirectory, fileName, arguments);
            process.WaitForExit();
            return process.ExitCode == 0;
        }
        catch
        {
            return false;
        }
    }

    private static int RunAndWait(string workingDirectory, string fileName, string arguments)
    {
        Process process = Start(workingDirectory, fileName, arguments);
        process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs args)
        {
            if (args.Data != null) Console.WriteLine(args.Data);
        };
        process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs args)
        {
            if (args.Data != null) Console.Error.WriteLine(args.Data);
        };
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        process.WaitForExit();
        return process.ExitCode;
    }

    private static Process Start(string workingDirectory, string fileName, string arguments)
    {
        ProcessStartInfo info = new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = arguments,
            WorkingDirectory = workingDirectory,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = false
        };

        Process process = new Process { StartInfo = info };
        process.Start();
        return process;
    }

    private static void HandleServerLine(object sender, DataReceivedEventArgs args)
    {
        if (args.Data == null) return;

        string line = StripAnsi(args.Data);
        Console.WriteLine(line);

        if (!openedBrowser && line.IndexOf("Local:", StringComparison.OrdinalIgnoreCase) >= 0)
        {
            OpenBrowser();
        }
    }

    private static string StripAnsi(string value)
    {
        return Regex.Replace(value, @"\x1B\[[0-9;]*[A-Za-z]", string.Empty);
    }

    private static void WaitForServerThenOpenBrowser()
    {
        DateTime deadline = DateTime.UtcNow.AddSeconds(20);
        while (!openedBrowser && DateTime.UtcNow < deadline && serverProcess != null && !serverProcess.HasExited)
        {
            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(Url);
                request.Method = "HEAD";
                request.Timeout = 500;
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    if ((int)response.StatusCode < 500)
                    {
                        OpenBrowser();
                        return;
                    }
                }
            }
            catch
            {
                Thread.Sleep(500);
            }
        }
    }

    private static void OpenBrowser()
    {
        if (openedBrowser) return;
        openedBrowser = true;

        Process.Start(new ProcessStartInfo
        {
            FileName = Url,
            UseShellExecute = true
        });
    }

    private static void StopServer()
    {
        if (serverProcess == null || serverProcess.HasExited) return;

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "taskkill.exe",
                Arguments = "/T /F /PID " + serverProcess.Id,
                UseShellExecute = false,
                CreateNoWindow = true
            });
        }
        catch
        {
            try { serverProcess.Kill(); } catch { }
        }
    }

    private static void Pause()
    {
        if (Console.IsInputRedirected) return;

        Console.WriteLine();
        Console.WriteLine("Press any key to close.");
        Console.ReadKey(true);
    }
}
