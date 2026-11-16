using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

static class PackageProgram {
 internal const string Product="日语研习室", Version="1.2.2", ArchiveRoot="日语研习室/";
 internal const string RegistryPath=@"Software\Microsoft\Windows\CurrentVersion\Uninstall\JapaneseStudyDesk";
 static readonly byte[] Magic=Encoding.ASCII.GetBytes("JLPT-DESK-PKG-V1");
 internal static readonly JavaScriptSerializer Json=new JavaScriptSerializer();
 [STAThread] static int Main(string[] args) {
  Application.EnableVisualStyles();
  Application.SetCompatibleTextRenderingDefault(false);
  string report=Option(args,"--report");
  try {
   if(args.Contains("--uninstall") || Path.GetFileName(Application.ExecutablePath).StartsWith("卸载")) {
    if(!args.Contains("--silent") && MessageBox.Show("将移除程序和离线音频，保留 data 文件夹中的学习记录。\n\n请先从托盘退出日语研习室的学习服务。确定卸载吗？",Product,MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return 0;
    var remaining=Uninstall();WriteReport(report,new Dictionary<string,object>{{"ok",true},{"progressPreserved",true},{"inUseFiles",remaining}});if(!args.Contains("--silent"))MessageBox.Show("卸载完成。学习记录保留在原安装位置的 data 文件夹中。"+(remaining.Count>0?"\n部分文件正被其他程序占用，已保留；关闭相关程序后可手动删除剩余文件夹。":""),Product);return 0;
   }
   if(!Environment.Is64BitOperatingSystem)throw new InvalidOperationException("此安装包需要 64 位 Windows 系统。");
   if(args.Contains("--preview")) {using(var window=new SetupWindow(true)){window.Show();Application.DoEvents();using(var bitmap=new Bitmap(window.Width,window.Height)){window.DrawToBitmap(bitmap,new Rectangle(Point.Empty,window.Size));bitmap.Save(Option(args,"--preview"),System.Drawing.Imaging.ImageFormat.Png);}window.Hide();}return 0;}
   if(args.Contains("--verify") || args.Contains("--extract")) {
    Dictionary<string,object> result;
    using(var payload=OpenPayload(null)) {
     result=Inspect(payload.Archive);
     if(args.Contains("--extract")) { var target=Option(args,"--extract");if(String.IsNullOrWhiteSpace(target))throw new Exception("缺少解包路径。");Extract(payload.Archive,target,null);result["directory"]=Path.GetFullPath(target); }
    }
    result["ok"]=true;result["sha256Verified"]=true;WriteReport(report,result);return 0;
   }
   Application.Run(new SetupWindow());return 0;
  } catch(Exception ex) {
   WriteReport(report,new Dictionary<string,object>{{"ok",false},{"error",ex.Message}});
   if(report==null&&!args.Contains("--silent"))MessageBox.Show(ex.Message,Product,MessageBoxButtons.OK,MessageBoxIcon.Error);else Console.Error.WriteLine(ex.ToString());return 1;
  }
 }
 static string Option(string[] args,string name){int i=Array.IndexOf(args,name);return i>=0&&i+1<args.Length?args[i+1]:null;}
 static void WriteReport(string path,object value){if(path!=null)File.WriteAllText(path,Json.Serialize(value),new UTF8Encoding(false));}
 internal sealed class Payload:IDisposable {
  internal FileStream File;internal SliceStream Stream;internal ZipArchive Archive;
  public void Dispose(){if(Archive!=null)Archive.Dispose();if(Stream!=null)Stream.Dispose();if(File!=null)File.Dispose();}
 }
 internal static Payload OpenPayload(Action<int,string> progress) {
  var p=new Payload();
  try {
   p.File=new FileStream(Application.ExecutablePath,FileMode.Open,FileAccess.Read,FileShare.Read,1024*1024);
   if(p.File.Length<56)throw new Exception("安装包不完整，请重新下载安装包。");
   p.File.Position=p.File.Length-56;
   byte[] expected;long length;
   using(var reader=new BinaryReader(p.File,Encoding.UTF8,true)) {
    if(!reader.ReadBytes(16).SequenceEqual(Magic))throw new Exception("安装包结尾校验信息缺失，请重新下载。");
    length=reader.ReadInt64();expected=reader.ReadBytes(32);
   }
   if(length<=0||length>p.File.Length-56)throw new Exception("安装包长度无效。");
   p.Stream=new SliceStream(p.File,p.File.Length-56-length,length);
   progress=progress??delegate{};var buffer=new byte[1024*1024];long done=0;int read;
   using(var hash=SHA256.Create()) {
    while((read=p.Stream.Read(buffer,0,buffer.Length))>0){hash.TransformBlock(buffer,0,read,buffer,0);done+=read;progress((int)(done*15/length),"正在校验安装包…");}
    hash.TransformFinalBlock(new byte[0],0,0);
    if(!hash.Hash.SequenceEqual(expected))throw new Exception("安装包校验失败，文件可能下载不完整，请重新下载。");
   }
   p.Stream.Position=0;p.Archive=new ZipArchive(p.Stream,ZipArchiveMode.Read,true,Encoding.UTF8);Inspect(p.Archive);return p;
  } catch {p.Dispose();throw;}
 }
 internal static Dictionary<string,object> Inspect(ZipArchive archive) {
  var names=new HashSet<string>(StringComparer.OrdinalIgnoreCase);long size=0;
  foreach(var entry in archive.Entries) {
   string relative=Relative(entry.FullName);
   if(!names.Add(relative))throw new Exception("安装包包含重复文件。");
   if(relative.Equals("data/progress.json",StringComparison.OrdinalIgnoreCase)||relative.StartsWith("evidence/",StringComparison.OrdinalIgnoreCase))throw new Exception("分享包不应包含个人学习记录或开发资料。");
   size+=entry.Length;
  }
  foreach(string name in new[]{"日语研习室.exe","卸载日语研习室.exe","runtime/node.exe","runtime/NODE-LICENSE.txt","server.mjs","lib/engine.mjs","public/index.html","public/theme.css","data/bank.json","data/media-index.json","data/offline-audio.json"})if(!names.Contains(name))throw new Exception("安装包缺少必要文件："+name);
  return new Dictionary<string,object>{{"product",Product},{"version",Version},{"files",names.Count},{"unpackedBytes",size},{"personalProgressIncluded",false}};
 }
 static string Relative(string name) {
  if(!name.StartsWith(ArchiveRoot,StringComparison.Ordinal)||name.Contains("\\"))throw new Exception("安装包文件路径无效。");
  string relative=name.Substring(ArchiveRoot.Length);
  if(String.IsNullOrWhiteSpace(relative)||relative.Split('/').Any(x=>x==".."||x=="."||x.Length==0||x.Contains(":")))throw new Exception("安装包文件路径无效。");
  return relative;
 }
 static string Inside(string root,string relative) {
  string target=Path.GetFullPath(Path.Combine(root,relative.Replace('/',Path.DirectorySeparatorChar)));
  if(!target.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new Exception("文件路径超出安装目录。");return target;
 }
 internal static void Extract(ZipArchive archive,string selected,Action<int,string> progress) {
  progress=progress??delegate{};
  string target=Path.GetFullPath(selected).TrimEnd(Path.DirectorySeparatorChar);
  if(target.Length<=Path.GetPathRoot(target).Length||File.Exists(target))throw new Exception("请选择有效的安装文件夹。");
  if(Directory.Exists(target)&&Directory.EnumerateFileSystemEntries(target).Any())throw new Exception("目标文件夹不是空的，请选择新的空文件夹。\n已有学习记录可先导出，安装后恢复备份。");
  string parent=Path.GetDirectoryName(target),stage=target+".install-"+Guid.NewGuid().ToString("N");
  long total=archive.Entries.Sum(x=>x.Length),done=0;
  var drive=new DriveInfo(Path.GetPathRoot(target));
  if(drive.AvailableFreeSpace<total+100L*1024*1024)throw new Exception("目标磁盘空间不足，需要约 2 GB 可用空间。");
  Directory.CreateDirectory(parent);Directory.CreateDirectory(stage);
  var installed=new List<string>();
  try {
   byte[] buffer=new byte[1024*1024];
   foreach(var entry in archive.Entries) {
    string relative=Relative(entry.FullName),file=Inside(stage,relative);Directory.CreateDirectory(Path.GetDirectoryName(file));
    using(var input=entry.Open())using(var output=new FileStream(file,FileMode.CreateNew,FileAccess.Write,FileShare.None,buffer.Length)) {
     int read;long written=0;
     while((read=input.Read(buffer,0,buffer.Length))>0){output.Write(buffer,0,read);done+=read;written+=read;progress(15+(int)(done*83/Math.Max(1,total)),"正在安装程序与离线听力…");}
     if(written!=entry.Length)throw new Exception("解包文件长度不正确："+relative);
    }
    installed.Add(relative);
   }
   File.WriteAllText(Path.Combine(stage,"installed-manifest.json"),Json.Serialize(new Dictionary<string,object>{{"app","jlpt-desk"},{"version",Version},{"files",installed}}),new UTF8Encoding(false));
   if(Directory.Exists(target))Directory.Delete(target,false);
   Directory.Move(stage,target);progress(100,"安装完成");
  } finally {
   // Only remove this operation's verified staging folder, never the installation or user data.
   if(stage.StartsWith(target+".install-",StringComparison.OrdinalIgnoreCase)&&Path.GetDirectoryName(stage)==parent&&Directory.Exists(stage))Directory.Delete(stage,true);
  }
 }
 internal static void Register(string target,bool desktop) {
  string exe=Path.Combine(target,Product+".exe");
  CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),"Programs",Product+".lnk"),exe,target);
  if(desktop)CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),Product+".lnk"),exe,target);
  using(var key=Registry.CurrentUser.CreateSubKey(RegistryPath)) {
   key.SetValue("DisplayName",Product);key.SetValue("DisplayVersion",Version);key.SetValue("Publisher","日语研习室 · 本地版");key.SetValue("InstallLocation",target);key.SetValue("DisplayIcon",exe);
   key.SetValue("UninstallString","\""+Path.Combine(target,"卸载日语研习室.exe")+"\" --uninstall");key.SetValue("NoModify",1,RegistryValueKind.DWord);key.SetValue("NoRepair",1,RegistryValueKind.DWord);key.SetValue("EstimatedSize",(int)(Directory.EnumerateFiles(target,"*",SearchOption.AllDirectories).Sum(x=>new FileInfo(x).Length)/1024),RegistryValueKind.DWord);
  }
 }
 static void CreateShortcut(string link,string exe,string root) {
  Directory.CreateDirectory(Path.GetDirectoryName(link));object shell=null,shortcut=null;
  try {shell=Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));shortcut=shell.GetType().InvokeMember("CreateShortcut",BindingFlags.InvokeMethod,null,shell,new object[]{link});var t=shortcut.GetType();t.InvokeMember("TargetPath",BindingFlags.SetProperty,null,shortcut,new object[]{exe});t.InvokeMember("WorkingDirectory",BindingFlags.SetProperty,null,shortcut,new object[]{root});t.InvokeMember("IconLocation",BindingFlags.SetProperty,null,shortcut,new object[]{exe+",0"});t.InvokeMember("Save",BindingFlags.InvokeMethod,null,shortcut,null);}
  finally{if(shortcut!=null)Marshal.ReleaseComObject(shortcut);if(shell!=null)Marshal.ReleaseComObject(shell);}
 }
 static void RemoveShortcut(string link,string expected) {
  if(!File.Exists(link))return;object shell=null,shortcut=null;
  try {shell=Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));shortcut=shell.GetType().InvokeMember("CreateShortcut",BindingFlags.InvokeMethod,null,shell,new object[]{link});string target=Convert.ToString(shortcut.GetType().InvokeMember("TargetPath",BindingFlags.GetProperty,null,shortcut,null));if(String.Equals(target,expected,StringComparison.OrdinalIgnoreCase))File.Delete(link);}
  finally{if(shortcut!=null)Marshal.ReleaseComObject(shortcut);if(shell!=null)Marshal.ReleaseComObject(shell);}
 }
 static List<string> Uninstall() {
  string root=Path.GetFullPath(AppDomain.CurrentDomain.BaseDirectory).TrimEnd(Path.DirectorySeparatorChar),manifest=Path.Combine(root,"installed-manifest.json");
  if(!File.Exists(manifest))throw new Exception("找不到安装清单，请勿单独移动卸载程序。");
  var data=Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(manifest));if(!data.ContainsKey("app")||Convert.ToString(data["app"])!="jlpt-desk")throw new Exception("安装清单无效。");
  foreach(string relative in new[]{Product+".exe","runtime/node.exe"}) {string file=Inside(root,relative);if(File.Exists(file))try{using(File.Open(file,FileMode.Open,FileAccess.ReadWrite,FileShare.None)){}}catch(IOException){throw new Exception("程序仍在运行，请先从托盘退出学习服务，再卸载。");}}
  var names=((System.Collections.IEnumerable)data["files"]).Cast<object>().Select(Convert.ToString).ToList();var dirs=new HashSet<string>();var remaining=new List<string>();
  foreach(string relative in names) {
   string file=Inside(root,relative);if(relative.StartsWith("data/",StringComparison.OrdinalIgnoreCase)||String.Equals(file,Application.ExecutablePath,StringComparison.OrdinalIgnoreCase))continue;
   if(File.Exists(file))try{File.Delete(file);}catch(IOException){remaining.Add(relative);}catch(UnauthorizedAccessException){remaining.Add(relative);}string dir=Path.GetDirectoryName(file);while(dir.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)){dirs.Add(dir);dir=Path.GetDirectoryName(dir);}
  }
  foreach(string dir in dirs.OrderByDescending(x=>x.Length))if(Directory.Exists(dir)&&!Directory.EnumerateFileSystemEntries(dir).Any())Directory.Delete(dir,false);
  string exe=Path.Combine(root,Product+".exe");RemoveShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),"Programs",Product+".lnk"),exe);RemoveShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),Product+".lnk"),exe);
  bool owns=false;using(var key=Registry.CurrentUser.OpenSubKey(RegistryPath))if(key!=null)owns=String.Equals(Convert.ToString(key.GetValue("InstallLocation")),root,StringComparison.OrdinalIgnoreCase);if(owns)Registry.CurrentUser.DeleteSubKeyTree(RegistryPath,false);
  return remaining;
 }
}

sealed class SliceStream:Stream {
 readonly Stream inner;readonly long start,length;long position;
 internal SliceStream(Stream stream,long offset,long count){inner=stream;start=offset;length=count;position=0;}
 public override bool CanRead{get{return true;}}public override bool CanSeek{get{return true;}}public override bool CanWrite{get{return false;}}
 public override long Length{get{return length;}}public override long Position{get{return position;}set{Seek(value,SeekOrigin.Begin);}}
 public override int Read(byte[] buffer,int offset,int count){if(position>=length)return 0;inner.Position=start+position;int read=inner.Read(buffer,offset,(int)Math.Min(count,length-position));position+=read;return read;}
 public override long Seek(long offset,SeekOrigin origin){long next=origin==SeekOrigin.Begin?offset:origin==SeekOrigin.Current?position+offset:length+offset;if(next<0||next>length)throw new IOException("安装包读取位置无效。");return position=next;}
 public override void Flush(){}public override void SetLength(long value){throw new NotSupportedException();}public override void Write(byte[] buffer,int offset,int count){throw new NotSupportedException();}
}

sealed class SetupWindow:Form {
 readonly bool preview;
 protected override bool ShowWithoutActivation {get{return preview;}}
 TextBox folder;Button install,browse;CheckBox desktop;ProgressBar progress;Label status;bool busy,complete;string target;
 internal SetupWindow(bool previewMode=false) {
  preview=previewMode;
  Text=PackageProgram.Product+" · 安装向导";ClientSize=new Size(640,460);FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;StartPosition=FormStartPosition.CenterScreen;BackColor=Color.FromArgb(252,248,255);Font=new Font("Microsoft YaHei UI",10);
  if(preview){ShowInTaskbar=false;Opacity=0;StartPosition=FormStartPosition.Manual;Location=new Point(-32000,-32000);}
  var banner=new Panel{Dock=DockStyle.Top,Height=132};banner.Paint+=(s,e)=>{using(var brush=new System.Drawing.Drawing2D.LinearGradientBrush(banner.ClientRectangle,Color.FromArgb(255,154,158),Color.FromArgb(161,140,209),0f))e.Graphics.FillRectangle(brush,banner.ClientRectangle);};Controls.Add(banner);
  banner.Controls.Add(new Label{Text=PackageProgram.Product,Font=new Font(Font.FontFamily,24,FontStyle.Bold),AutoSize=true,Location=new Point(28,24),BackColor=Color.Transparent,ForeColor=Color.FromArgb(53,35,65)});
  banner.Controls.Add(new Label{Text="JLPT DESK  ·  "+PackageProgram.Version+"  ·  Windows 64 位",AutoSize=true,Location=new Point(31,84),BackColor=Color.Transparent,ForeColor=Color.FromArgb(53,35,65)});
  Controls.Add(new Label{Text="N1–N5 题库与全部听力已内置，无需另装运行环境。",AutoSize=true,Location=new Point(28,155),ForeColor=Color.FromArgb(88,64,104)});
  Controls.Add(new Label{Text="安装位置",AutoSize=true,Location=new Point(28,199)});
  folder=new TextBox{Text=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs",PackageProgram.Product),Location=new Point(28,227),Size=new Size(476,29)};Controls.Add(folder);
  browse=new Button{Text="浏览…",Location=new Point(516,225),Size=new Size(95,32)};browse.Click+=(s,e)=>{using(var dialog=new FolderBrowserDialog{Description="选择安装位置的上级文件夹"})if(dialog.ShowDialog(this)==DialogResult.OK)folder.Text=Path.Combine(dialog.SelectedPath,PackageProgram.Product);};Controls.Add(browse);
  desktop=new CheckBox{Text="创建桌面快捷方式",Checked=true,AutoSize=true,Location=new Point(28,274)};Controls.Add(desktop);
  status=new Label{Text="约需 2 GB 空间。学习进度保存在安装目录的 data 文件夹中。",Location=new Point(28,319),Size=new Size(584,37),ForeColor=Color.FromArgb(120,98,129)};Controls.Add(status);
  progress=new ProgressBar{Location=new Point(28,364),Size=new Size(584,10)};Controls.Add(progress);
  install=new Button{Text="开始安装",Location=new Point(451,398),Size=new Size(160,38),FlatStyle=FlatStyle.Flat,BackColor=Color.FromArgb(115,81,166),ForeColor=Color.White};install.FlatAppearance.BorderSize=0;install.Click+=Install;Controls.Add(install);
  Controls.Add(new Label{Text="无需管理员权限",AutoSize=true,Location=new Point(28,408),ForeColor=Color.FromArgb(120,98,129)});
  FormClosing+=(s,e)=>{if(busy)e.Cancel=true;};
 }
 void Install(object sender,EventArgs ev) {
  if(complete){Process.Start(new ProcessStartInfo(Path.Combine(target,PackageProgram.Product+".exe")){UseShellExecute=true});Close();return;}
  busy=true;install.Enabled=false;folder.Enabled=false;browse.Enabled=false;desktop.Enabled=false;target=folder.Text;bool shortcut=desktop.Checked;
  var worker=new BackgroundWorker{WorkerReportsProgress=true};int last=-1;
  worker.ProgressChanged+=(s,e)=>{progress.Value=e.ProgressPercentage;status.Text=Convert.ToString(e.UserState);};
  worker.DoWork+=(s,e)=>{target=Path.GetFullPath(target);Action<int,string> report=(n,message)=>{if(n!=last){last=n;worker.ReportProgress(n,message);}};using(var p=PackageProgram.OpenPayload(report))PackageProgram.Extract(p.Archive,target,report);};
  worker.RunWorkerCompleted+=(s,e)=>{
   busy=false;
   if(e.Error!=null){status.Text="安装未完成，可调整安装位置后重试。";MessageBox.Show(this,e.Error.Message,"安装未完成",MessageBoxButtons.OK,MessageBoxIcon.Error);install.Enabled=true;folder.Enabled=true;browse.Enabled=true;desktop.Enabled=true;return;}
   try{PackageProgram.Register(target,shortcut);status.Text="安装完成，可从桌面或开始菜单打开。";}catch(Exception ex){status.Text="程序已安装，可直接打开安装文件夹中的日语研习室.exe。";MessageBox.Show(this,"创建快捷方式或登记安装信息未完成："+ex.Message,"程序已安装");}
   complete=true;progress.Value=100;install.Text="开始学习";install.Enabled=true;
  };worker.RunWorkerAsync();
 }
}
