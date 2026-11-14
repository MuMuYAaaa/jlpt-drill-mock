using System;
using System.IO;
using System.Net;
using System.Diagnostics;
using System.Drawing;
using System.Threading;
using System.Windows.Forms;

static class Launcher {
 const string Url="http://127.0.0.1:47321";
 static NotifyIcon tray;
 static Process server;
 static string root=AppDomain.CurrentDomain.BaseDirectory;
 [STAThread] static void Main(string[] args) {
  Application.EnableVisualStyles();
  bool owner;
  using(var mutex=new Mutex(true,"Local\\JapaneseStudyDesk47321",out owner)) {
   if(!owner){ Open(); return; }
   try {
    if(!Healthy()) {
     var node=Path.Combine(root,"runtime","node.exe");
     if(!File.Exists(node)) throw new Exception("找不到随附的 Node 运行时，请保持程序文件夹完整。");
     var start=new ProcessStartInfo(node,"--no-warnings \""+Path.Combine(root,"server.mjs")+"\"");
     start.WorkingDirectory=root;start.UseShellExecute=false;start.CreateNoWindow=true;
     server=Process.Start(start);
     bool ready=false;
     for(int i=0;i<100;i++){if(Healthy()){ready=true;break;}if(server.HasExited)break;Thread.Sleep(200);}
     if(!ready) throw new Exception("本地学习服务未能启动。请检查 47321 端口是否被占用，或在程序目录运行 启动诊断.cmd 查看详情。");
    }
    if(args.Length>0&&args[0]=="--check"){Stop();return;}
    tray=new NotifyIcon();tray.Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application;tray.Text="日语研习室 · 本地学习服务";
    var menu=new ContextMenuStrip();menu.Items.Add("打开日语研习室",null,delegate{Open();});
    menu.Items.Add("打开数据文件夹",null,delegate{Process.Start("explorer.exe",Path.Combine(root,"data"));});
    menu.Items.Add(new ToolStripSeparator());menu.Items.Add("退出学习服务",null,delegate{Stop();Application.Exit();});
    tray.ContextMenuStrip=menu;tray.DoubleClick+=delegate{Open();};tray.Visible=true;
    Application.ApplicationExit+=delegate{Stop();tray.Dispose();};
    if(!(args.Length>0&&args[0]=="--background"))Open();Application.Run();
   } catch(Exception e){Stop();MessageBox.Show(e.Message,"日语研习室",MessageBoxButtons.OK,MessageBoxIcon.Error);}
  }
 }
 static bool Healthy(){try{var req=(HttpWebRequest)WebRequest.Create(Url+"/api/health");req.Timeout=800;using(var res=req.GetResponse())using(var reader=new StreamReader(res.GetResponseStream()))return reader.ReadToEnd().Contains("jlpt-desk");}catch{return false;}}
 static void Open(){
  var edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Microsoft","Edge","Application","msedge.exe");
  if(!File.Exists(edge))edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Microsoft","Edge","Application","msedge.exe");
  try{
   if(File.Exists(edge))Process.Start(new ProcessStartInfo(edge,"--app="+Url+" --window-size=1440,960"){UseShellExecute=true});
   else Process.Start(new ProcessStartInfo(Url){UseShellExecute=true});
  }catch(Exception e){MessageBox.Show("请使用浏览器打开 "+Url+"\n"+e.Message,"日语研习室");}
 }
 static void Stop(){try{if(server!=null&&!server.HasExited){server.Kill();server.WaitForExit(3000);}}catch{}server=null;}
}
