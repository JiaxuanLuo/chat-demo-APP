import org.gradle.api.GradleException
import org.gradle.api.tasks.Sync

plugins {
    id("com.android.application")
}

android {
    namespace = "com.chatdemo.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.chatdemo.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 2
        versionName = "0.2.0"

        // 语音输入使用 WebView 的 getUserMedia，不需要额外声明原生组件
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // 演示包用 debug 签名，确保 release APK 也能直接安装；
            // 正式发布时请替换为自己的签名配置。
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets.getByName("main") {
        // 网页构建产物由下面的 syncWebAssets 同步到 build/web-assets
        assets.srcDir(layout.buildDirectory.dir("web-assets"))
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

val webAssetsDir = layout.buildDirectory.dir("web-assets")
val distDir = rootProject.layout.projectDirectory.dir("../dist")

val syncWebAssets = tasks.register<Sync>("syncWebAssets") {
    from(distDir)
    into(webAssetsDir)
    doFirst {
        if (!distDir.file("index.html").asFile.exists()) {
            throw GradleException(
                "dist/index.html 不存在。请先在项目根目录运行 pnpm build 生成网页产物。"
            )
        }
    }
}

tasks.named("preBuild") {
    dependsOn(syncWebAssets)
}
